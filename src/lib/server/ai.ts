import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { aiModel } from "@/lib/env";
import {
  draftSchema, qualificationSchema, strategySchema,
  type BusinessInput, type BusinessProfile, type Icp, type Qualification, type Strategy, type Draft,
} from "@/lib/schemas";

const NO_FABRICATION = "Never invent facts about specific companies or people. Use only data supplied in the prompt.";

async function generate<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  const { output } = await generateText({
    model: aiModel(),
    output: Output.object({ schema }),
    system,
    prompt,
  });
  return output;
}

export function generateStrategy(input: BusinessInput): Promise<Strategy> {
  return generate(
    strategySchema,
    `You are a B2B sales strategist. Reason backwards from what is sold: which businesses have a reason to buy it,
what signals indicate need, and who decides. Produce a business profile, an Ideal Customer Profile and short
market insights. Industries must be LinkedIn-style industry names. Countries must be full English names.
Buyer roles must fit this product's buying process. Market insights are general context, not facts about specific companies.`,
    JSON.stringify(input),
  );
}

export async function qualifyCompanies(
  profile: BusinessProfile, icp: Icp, companies: { crustdata_company_id: number }[],
): Promise<Qualification[]> {
  const { results } = await generate(
    z.object({ results: z.array(qualificationSchema) }),
    `You qualify B2B prospects for the seller below against the approved ICP.
Rubric: icpFit 0-40, useCaseRelevance 0-30, observedSignals 0-20 (only signals visible in the record, e.g. funding,
hiring, headcount or follower growth), geography 0-10. The score is an explainable fit assessment, not a purchase probability.
Evidence fields must be dotted paths that exist in the supplied company record. List important missing information.
Return one result per company using its crustdata_company_id as companyId. ${NO_FABRICATION}`,
    JSON.stringify({ seller: profile, icp, companies }),
  );
  return results;
}

export async function pickDecisionMakers(
  profile: BusinessProfile, icp: Icp, company: string,
  people: { personId: number; name: string; title: string }[],
): Promise<{ personId: number; relevance: string }[]> {
  if (!people.length) return [];
  const { picks } = await generate(
    z.object({ picks: z.array(z.object({ personId: z.number().int(), relevance: z.string() })) }),
    `Select up to 3 people at ${company} most likely to own or influence buying this offering, based on the target buyer roles.
Explain each pick in one sentence. Pick only from the supplied list; return an empty list if nobody is relevant. ${NO_FABRICATION}`,
    JSON.stringify({ offering: profile.offering, buyerRoles: icp.buyerRoles, people }),
  );
  const valid = new Set(people.map((p) => p.personId));
  return picks.filter((p) => valid.has(p.personId)).slice(0, 3);
}

export function generateDraft(context: {
  profile: BusinessProfile; icp: Icp; company: unknown; qualification: unknown;
  contact: { name: string; title: string; relevance?: string };
}): Promise<Draft> {
  return generate(
    draftSchema,
    `Write a concise personalised B2B cold email (under 150 words) from the seller to the contact.
Explain why this specific company is being approached, using only the supplied company data and qualification evidence,
and why the offering is relevant to the contact's role. End with one clear, low-friction call to action.
Do not include placeholders for facts you do not have. Sign off with the seller's company name. ${NO_FABRICATION}`,
    JSON.stringify(context),
  );
}
