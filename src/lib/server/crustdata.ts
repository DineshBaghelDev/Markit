import "server-only";

import { z } from "zod";
import { requireServerEnv } from "@/lib/env";
import type { CompanySearchQuery, PersonSearchQuery } from "@/lib/crustdata-filters";

const BASE_URL = "https://api.crustdata.com";

async function crustdataRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
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

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Crustdata ${path} failed (HTTP ${response.status}): ${detail}`);
  }
  return schema.parse(await response.json());
}

// Free account endpoint for verifying the integration without consuming credits.
export async function getCrustdataCredits(): Promise<number> {
  const schema = z.object({ account: z.object({ credits: z.number() }) });
  return (await crustdataRequest("/account/credits", schema)).account.credits;
}

const suggestionsSchema = z.object({ suggestions: z.array(z.object({ value: z.string() })) });

// Map free-text values (e.g. LLM industry names) to exact indexed values.
export async function companyAutocomplete(field: string, query: string, limit = 3): Promise<string[]> {
  const result = await crustdataRequest("/company/search/autocomplete", suggestionsSchema, { field, query, limit });
  return result.suggestions.map((s) => s.value);
}

export const crustdataCompanySchema = z.looseObject({
  crustdata_company_id: z.number(),
  basic_info: z.looseObject({
    name: z.string().nullish(),
    primary_domain: z.string().nullish(),
  }).nullish(),
});
export type CrustdataCompany = z.infer<typeof crustdataCompanySchema>;

export async function companySearch(query: CompanySearchQuery): Promise<CrustdataCompany[]> {
  const schema = z.object({ companies: z.array(crustdataCompanySchema) });
  return (await crustdataRequest("/company/search", schema, query)).companies;
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

export async function personSearch(query: PersonSearchQuery): Promise<CrustdataPerson[]> {
  const schema = z.object({ profiles: z.array(crustdataPersonSchema) });
  return (await crustdataRequest("/person/search", schema, query)).profiles;
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
    const result = await crustdataRequest("/person/contact/enrich", contactEnrichSchema, {
      professional_network_profile_urls: batch,
      fields: ["contact.business_emails"],
    });
    for (const entry of result) {
      const options = entry.matches?.[0]?.person_data.contact?.business_emails ?? [];
      const best = options.find((e) => e.status === "deliverable") ?? options[0];
      if (best) emails.set(entry.matched_on, best.email);
    }
  }
  return emails;
}
