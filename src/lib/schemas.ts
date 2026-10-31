import { z } from "zod";

// User input for a new sales project.
export const businessInputSchema = z.object({
  companyName: z.string().trim().max(200).default(""),
  website: z.string().trim().max(300).default(""),
  product: z.string().trim().max(3_000).default(""),
  valueProposition: z.string().trim().max(2_000).default(""),
  geography: z.string().trim().max(300).default(""),
  objective: z.string().trim().max(1_000).default(""),
  proofPoints: z.string().trim().max(2_000).default(""),
  // Text extracted server-side from uploaded seller documents.
  documents: z.array(z.object({ name: z.string(), text: z.string(), truncated: z.boolean() })).max(5).default([]),
}).refine((input) => input.product || input.documents.length, {
  message: "Describe what you sell or upload a company document.",
  path: ["product"],
});
// Fields the client sends (documents are added server-side) and the parsed server-side shape.
export type BusinessInput = Omit<z.input<typeof businessInputSchema>, "documents"> & {
  [K in "companyName" | "website" | "product" | "valueProposition" | "geography" | "objective" | "proofPoints"]: string;
};
export type ParsedBusinessInput = z.output<typeof businessInputSchema>;

// LLM output schemas use nullable instead of optional so strict structured output works.
export const businessProfileSchema = z.object({
  companyName: z.string(),
  summary: z.string(),
  offering: z.string(),
  problemSolved: z.string(),
  valueProposition: z.string(),
  salesObjective: z.string(),
  proofPoints: z.array(z.string()).default([]).describe(
    "Verifiable seller claims stated in the input or documents: named customers, results, certifications, awards. Empty if none.",
  ),
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
  citations: z.array(z.object({
    field: z.string().describe("Dotted path in the supplied company record that a statement in the email relies on"),
    statement: z.string().describe("The statement in the email that this field supports"),
  })),
});
export type Draft = z.infer<typeof draftSchema>;
