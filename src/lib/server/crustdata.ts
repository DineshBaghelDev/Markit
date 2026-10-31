import "server-only";

import { z } from "zod";
import { requireServerEnv } from "@/lib/env";
import { withDemoCache } from "@/lib/server/demo-cache";
import type { CompanySearchQuery, PersonSearchQuery } from "@/lib/crustdata-filters";

const BASE_URL = "https://api.crustdata.com";

// POST calls go through the demo cache; `cached` tells callers the data was replayed, not fetched now.
async function cachedRequest<T>(path: string, schema: z.ZodType<T>, body: unknown) {
  const { value, cached } = await withDemoCache(`crustdata${path.replaceAll("/", "-")}`, body, () =>
    crustdataRequest(path, z.unknown(), body));
  return { value: schema.parse(value), cached };
}

export class CrustdataError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const RETRY_DELAYS_MS = [1_000, 3_000];
const isRetryable = (status: number) => status === 429 || status >= 500;

// Retries rate limits, server errors and network timeouts; other client errors fail immediately.
async function crustdataRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${requireServerEnv("CRUSTDATA_API_KEY")}`,
          "x-api-version": "2025-11-01",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch (error) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw new CrustdataError(`Crustdata ${path} unreachable: ${error instanceof Error ? error.message : error}`, 0);
    }

    if (response.ok) return schema.parse(await response.json());
    if (isRetryable(response.status) && attempt < RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    const detail = (await response.text()).slice(0, 300);
    throw new CrustdataError(`Crustdata ${path} failed (HTTP ${response.status}): ${detail}`, response.status);
  }
}

// Free account endpoint for verifying the integration without consuming credits.
export async function getCrustdataCredits(): Promise<number> {
  const schema = z.object({ account: z.object({ credits: z.number() }) });
  return (await crustdataRequest("/account/credits", schema)).account.credits;
}

const suggestionsSchema = z.object({ suggestions: z.array(z.object({ value: z.string() })) });

// Map free-text values (e.g. LLM industry names) to exact indexed values.
export async function companyAutocomplete(field: string, query: string, limit = 3): Promise<string[]> {
  const { value } = await cachedRequest("/company/search/autocomplete", suggestionsSchema, { field, query, limit });
  return value.suggestions.map((s) => s.value);
}

export const crustdataCompanySchema = z.looseObject({
  crustdata_company_id: z.number(),
  basic_info: z.looseObject({
    name: z.string().nullish(),
    primary_domain: z.string().nullish(),
  }).nullish(),
});
export type CrustdataCompany = z.infer<typeof crustdataCompanySchema>;

export async function companySearch(query: CompanySearchQuery) {
  const schema = z.object({ companies: z.array(crustdataCompanySchema) });
  const { value, cached } = await cachedRequest("/company/search", schema, query);
  return { companies: value.companies, cached };
}

export const crustdataPersonSchema = z.looseObject({
  crustdata_person_id: z.number(),
  basic_profile: z.looseObject({
    name: z.string().nullish(),
    headline: z.string().nullish(),
    current_title: z.string().nullish(),
  }).nullish(),
  contact: z.looseObject({ has_business_email: z.boolean().nullish() }).nullish(),
  social_handles: z.looseObject({
    professional_network_identifier: z.looseObject({ profile_url: z.string().nullish() }).nullish(),
  }).nullish(),
  experience: z.looseObject({
    employment_details: z.looseObject({
      current: z.array(z.looseObject({
        crustdata_company_id: z.number().nullish(),
        name: z.string().nullish(),
        title: z.string().nullish(),
        seniority_level: z.string().nullish(),
        business_email_verified: z.boolean().nullish(),
      })).nullish(),
    }).nullish(),
  }).nullish(),
});
export type CrustdataPerson = z.infer<typeof crustdataPersonSchema>;

export async function personSearch(query: PersonSearchQuery) {
  const schema = z.object({ profiles: z.array(crustdataPersonSchema) });
  const { value, cached } = await cachedRequest("/person/search", schema, query);
  return { profiles: value.profiles, cached };
}

const contactEnrichSchema = z.array(z.looseObject({
  matched_on: z.string(),
  matches: z.array(z.looseObject({
    person_data: z.looseObject({
      contact: z.looseObject({
        business_emails: z.array(z.object({ email: z.string(), status: z.string().nullish() })).nullish(),
      }).nullish(),
    }),
  })).nullish(),
}));

// Returns profileUrl -> best business email. Profiles without a match are absent.
export async function enrichBusinessEmails(profileUrls: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (let i = 0; i < profileUrls.length; i += 25) {
    const batch = profileUrls.slice(i, i + 25);
    const { value } = await cachedRequest("/person/contact/enrich", contactEnrichSchema, {
      professional_network_profile_urls: batch,
      fields: ["contact.business_emails"],
    });
    for (const entry of value) {
      const options = entry.matches?.[0]?.person_data.contact?.business_emails ?? [];
      const best = options.find((e) => e.status === "deliverable") ?? options[0];
      if (best) emails.set(entry.matched_on, best.email);
    }
  }
  return emails;
}
