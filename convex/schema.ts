import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Structured LLM/Crustdata payloads are validated with Zod in the Next.js routes before they are stored.
// manual = a test contact added by the user (e.g. their own address for demo sends), never Crustdata data.
export const source = v.union(v.literal("live"), v.literal("fixture"), v.literal("manual"));
export const emailStatus = v.union(v.literal("unavailable"), v.literal("not_enriched"), v.literal("enriched"));
export const draftStatus = v.union(v.literal("draft"), v.literal("approved"), v.literal("exported"), v.literal("sent"));

export default defineSchema({
  projects: defineTable({
    input: v.any(),
    profile: v.any(),
    icp: v.any(),
    insights: v.any(),
    // User-chosen project name; the UI falls back to "<company>, <geography>".
    name: v.optional(v.string()),
    // Set for guided example runs: each step replays this completed project's results.
    demoOf: v.optional(v.id("projects")),
    icpApproved: v.boolean(),
    status: v.string(),
    // When status last changed; used to detect background runs that died (see runState.ts).
    statusAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  companies: defineTable({
    projectId: v.id("projects"),
    crustdataId: v.number(),
    name: v.string(),
    domain: v.optional(v.string()),
    segment: v.string(),
    data: v.any(),
    score: v.optional(v.number()),
    qualification: v.optional(v.any()),
    selected: v.boolean(),
    source,
  }).index("by_projectId", ["projectId"]),
  contacts: defineTable({
    projectId: v.id("projects"),
    companyId: v.id("companies"),
    crustdataPersonId: v.number(),
    name: v.string(),
    title: v.string(),
    profileUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    emailStatus,
    relevance: v.string(),
    selected: v.boolean(),
    source,
  }).index("by_projectId", ["projectId"]),
  drafts: defineTable({
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    subject: v.string(),
    body: v.string(),
    cta: v.string(),
    valueProposition: v.string(),
    citations: v.optional(v.array(v.object({ field: v.string(), statement: v.string(), value: v.string() }))),
    status: draftStatus,
    sentAt: v.optional(v.number()),
    messageId: v.optional(v.string()),
  }).index("by_projectId", ["projectId"]).index("by_contactId", ["contactId"]),
});
