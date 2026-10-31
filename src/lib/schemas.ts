import { z } from "zod";

// User input for a new sales project.
export const businessInputSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  website: z.string().trim().max(300).default(""),
  product: z.string().trim().min(1, "Describe what you sell.").max(3_000),
  valueProposition: z.string().trim().max(2_000).default(""),
  geography: z.string().trim().min(1, "Enter a target geography.").max(300),
  objective: z.string().trim().max(1_000).default(""),
  proofPoints: z.string().trim().max(2_000).default(""),
});
export type BusinessInput = z.infer<typeof businessInputSchema>;

// LLM output schemas use nullable instead of optional so strict structured output works.
export const businessProfileSchema = z.object({
  companyName: z.string(),
  summary: z.string(),
  offering: z.string(),
  problemSolved: z.string(),
  valueProposition: z.string(),
  salesObjective: z.string(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const icpSchema = z.object({
  segments: z.array(z.object({
    name: z.string(),
    searchQuery: z.string().default("").describe("One sentence describing the ideal company in this segment the way its own company description would read; used for semantic search"),
    industries: z.array(z.string()).describe("LinkedIn-style industry names, e.g. 'Utilities', 'Software Development'"),
    useCases: z.array(z.string()),
    rationale: z.string(),
  })).min(1).max(4),
  minEmployees: z.number().int().nullable(),
  maxEmployees: z.number().int().nullable(),
  countries: z.array(z.string()).min(1).describe("Full English country names"),
  buyingSignals: z.array(z.string()),
  buyerRoles: z.array(z.object({ title: z.string(), why: z.string() })).min(1).max(6),
  exclusions: z.array(z.string()),
  reasoning: z.string(),
});
export type Icp = z.infer<typeof icpSchema>;

export const insightsSchema = z.object({
  trends: z.array(z.string()),
  demandDrivers: z.array(z.string()),
  opportunities: z.array(z.string()),
});
export type Insights = z.infer<typeof insightsSchema>;

export const strategySchema = z.object({
  profile: businessProfileSchema,
  icp: icpSchema,
  insights: insightsSchema,
});
export type Strategy = z.infer<typeof strategySchema>;

export const qualificationSchema = z.object({
  companyId: z.number().int(),
  icpFit: z.number().describe("0-40"),
  useCaseRelevance: z.number().describe("0-35"),
  observedSignals: z.number().describe("0-25; 0 if no relevant signal is present in the data"),
  reasons: z.array(z.string()),
  evidence: z.array(z.object({
    field: z.string().describe("Dotted path of the field in the supplied company record, e.g. funding.last_round_type"),
    claim: z.string(),
  })),
  missingInformation: z.array(z.string()),
});
export type Qualification = z.infer<typeof qualificationSchema>;

export const draftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  cta: z.string(),
  valueProposition: z.string(),
});
export type Draft = z.infer<typeof draftSchema>;
