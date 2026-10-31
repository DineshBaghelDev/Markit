import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { llmConfig } from "@/lib/env";
import { withDemoCache } from "@/lib/server/demo-cache";
import {
  draftSchema, qualificationSchema, strategySchema,
  type BusinessInput, type BusinessProfile, type Icp, type Qualification, type Strategy, type Draft,
} from "@/lib/schemas";

function languageModel(): { model: LanguageModel; id: string } {
  const { baseURL, model, apiKey } = llmConfig();
  if (!baseURL) return { model, id: model };
  const provider = createOpenAICompatible({ name: "local-llm", baseURL, apiKey, supportsStructuredOutputs: true });
  return { model: provider(model), id: `${baseURL}|${model}` };
}

const GROUNDING_RULES = `
Grounding rules (mandatory):
- Use only facts present in the input. Never invent company facts, people, numbers, customers, funding, news or contact details.
- If something is unknown, say it is unknown or list it as missing information; do not guess.
- Respond with a single JSON object matching the requested schema. No markdown, no commentary outside JSON.`;

// Structured generation: schema-constrained, Zod-validated, one retry (some compatible servers do not enforce schemas).
async function generate<T>(name: string, schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  const { model, id } = languageModel();
  // The exact schema is also stated in the prompt because some compatible servers do not enforce response_format.
  const fullSystem = `${system}${GROUNDING_RULES}
- The JSON must conform exactly to this JSON Schema: use exactly these keys, types and nesting, no extra keys:
${JSON.stringify(z.toJSONSchema(schema))}`;

  const { value } = await withDemoCache(`llm-${name}`, { id, system: fullSystem, prompt }, async () => {
    let lastError: unknown;
    let retryNote = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema, name }),
          system: fullSystem,
          prompt: prompt + retryNote,
        });
        return output;
      } catch (error) {
        lastError = error;
        if (!NoObjectGeneratedError.isInstance(error)) throw error;
        console.error(`[llm:${name}] invalid output (attempt ${attempt + 1}):`, String(error.cause).slice(0, 800));
        // Tell the model what was wrong so the retry can correct its shape.
        retryNote = `\n\nYour previous answer failed schema validation:\n${String(error.cause).slice(0, 1500)}\nReturn corrected JSON only.`;
      }
    }
    throw lastError;
  });
  return value;
}

const STRATEGY_SYSTEM = `You are Markit, a senior B2B go-to-market strategist. A seller tells you what they sell and where.
Reason backwards from the offering: what exactly is sold, which businesses have a concrete reason to buy it,
what observable signals suggest need, who owns the buying decision, and what would disqualify a prospect.

Produce three parts:

1. profile: a faithful restatement of the seller (do not add capabilities they did not mention).
   - summary: 2-3 sentences. offering: what is sold. problemSolved / valueProposition: buyer-centric wording.
   - salesObjective: the objective stated by the user, or a sensible one inferred from the input (say "inferred").

2. icp: an Ideal Customer Profile that will be converted into database filters.
   - segments: 2-4 distinct customer segments, highest priority first. For each:
     - industries: 1-4 LinkedIn company industry names exactly as LinkedIn spells them
       (e.g. "Utilities", "Oil and Gas", "Renewable Energy Power Generation", "Construction", "Real Estate",
       "Hospitals and Health Care", "Software Development", "IT Services and IT Consulting", "Financial Services",
       "Retail", "Manufacturing", "Telecommunications", "Data Infrastructure and Analytics").
     - useCases: how this segment would use the offering. rationale: why this segment has a reason to buy.
   - minEmployees / maxEmployees: realistic company size bounds for buyers of this offering (null if size does not matter).
   - countries: full English country names covering the requested geography (e.g. "United Arab Emirates").
   - buyingSignals: signals that could be observed in company data or news: recent funding, headcount growth,
     hiring for relevant roles, expansion, new facilities, regulatory deadlines, technology adoption.
   - buyerRoles: 3-6 job titles as they appear on LinkedIn for people who own or influence this purchase,
     adapted to this offering's buying process (e.g. facilities/energy/operations leaders for physical infrastructure;
     CTO/VP Engineering/Head of Product for developer tools). Include why each matters.
   - exclusions: who should NOT be targeted (competitors, too small, wrong business model, resellers if irrelevant).
   - reasoning: 3-5 sentences explaining the logic connecting the offering to the segments and roles.

3. insights: short market context for the target geography: trends, demand drivers and opportunities
   (3-5 bullets each, one sentence each). This is general context, not facts about specific companies.
   Avoid precise statistics unless they are well established; prefer qualitative statements.`;

export function generateStrategy(input: BusinessInput): Promise<Strategy> {
  return generate("strategy", strategySchema, STRATEGY_SYSTEM, `Seller input:\n${JSON.stringify(input, null, 2)}`);
}

const QUALIFY_SYSTEM = `You are Markit's prospect qualification analyst. Score each company record against the seller's
approved ICP using this fixed rubric. The total is an explainable fit assessment, NOT a probability of purchase.

- icpFit (0-40): industry, business model and company size match the ICP segments; 0 if an exclusion applies.
  35-40 clear match, 20-34 partial, 1-19 weak.
- useCaseRelevance (0-30): how plausibly this specific company has the use cases the offering addresses,
  judged from its description and industry.
- observedSignals (0-20): only signals visible in the record: funding (recent round, amount, date), headcount size or
  growth, hiring data, follower growth, recent founding. 0 when the record shows no relevant signal.
- geography (0-10): headquarters or offices in the target countries.

For each company return:
- companyId: its crustdata_company_id.
- reasons: 2-4 short sentences on why it is or is not a relevant prospect for this seller.
- evidence: facts supporting the score; each item's field MUST be a dotted path that exists in that company's record
  (e.g. "basic_info.description", "taxonomy.professional_network_industry", "headcount.total",
  "funding.last_fundraise_date", "locations.country") and claim states what that value shows.
- missingInformation: what is unknown but would change the assessment (e.g. "No hiring data", "Energy usage unknown").
Return exactly one result per company supplied.`;

export async function qualifyCompanies(
  profile: BusinessProfile, icp: Icp, companies: { crustdata_company_id: number }[],
): Promise<Qualification[]> {
  const { results } = await generate(
    "qualify",
    z.object({ results: z.array(qualificationSchema) }),
    QUALIFY_SYSTEM,
    JSON.stringify({ seller: profile, approvedIcp: icp, companies }),
  );
  return results;
}

const DECISION_MAKER_SYSTEM = `You are Markit's account researcher. From the people currently employed at one company,
choose those who would own, sponsor or strongly influence the purchase of the seller's offering.
- Prefer people whose title matches or is close to the target buyer roles, then senior general management
  (CEO/MD/founder) for small companies.
- Skip interns, students, junior individual contributors and roles unrelated to the purchase.
- Choose at most 3 people, best first. Return an empty list when nobody is a reasonable contact.
- personId must be copied from the supplied list. relevance: one sentence on why this role matters for this purchase.`;

export async function pickDecisionMakers(
  profile: BusinessProfile, icp: Icp, company: string,
  people: { personId: number; name: string; title: string }[],
): Promise<{ personId: number; relevance: string }[]> {
  if (!people.length) return [];
  const { picks } = await generate(
    "decision-makers",
    z.object({ picks: z.array(z.object({ personId: z.number().int(), relevance: z.string() })) }),
    DECISION_MAKER_SYSTEM,
    JSON.stringify({ company, offering: profile.offering, buyerRoles: icp.buyerRoles, people }),
  );
  const valid = new Set(people.map((p) => p.personId));
  return picks.filter((p) => valid.has(p.personId)).slice(0, 3);
}

const OUTREACH_SYSTEM = `You are Markit's B2B copywriter. Write one personalised first-touch cold email from the seller
to a specific contact.

Content:
- Open with why this specific company is being contacted, using one or two concrete facts from the supplied company
  record or qualification evidence (industry, what they do, size, funding, growth, location). No generic flattery.
- Connect the seller's offering to a problem this company and this contact's role plausibly have; say "may" or
  "could" rather than asserting their internal situation.
- Do not mention scores, "ICP", data providers or that you looked them up in a database.
- Do not tell the contact what information you lack ("your loads are unknown"); simply avoid claims you cannot support.
  At most one light qualifier such as "may" per paragraph; write with quiet confidence.
- Do not invent results, customers, case studies, prices or statistics about the seller.
- No placeholders such as [Name] or {Company}. Address the contact by first name.

Format:
- subject: under 8 words, specific to the company, no clickbait.
- body: plain text, 80-140 words, short paragraphs, ending with the call to action and a sign-off from the
  seller's company name. No "I hope this email finds you well".
- cta: the single low-friction ask used in the body (e.g. a 20-minute call next week).
- valueProposition: one sentence on the value for this specific company.`;

export function generateDraft(context: {
  profile: BusinessProfile; icp: Icp; company: unknown; qualification: unknown;
  contact: { name: string; title: string; relevance?: string };
}): Promise<Draft> {
  return generate("outreach", draftSchema, OUTREACH_SYSTEM, JSON.stringify(context));
}
