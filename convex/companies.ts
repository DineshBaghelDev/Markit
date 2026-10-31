import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { source } from "./schema";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, { projectId }) =>
    ctx.db.query("companies").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(200),
});

// A new discovery run replaces earlier results (and their contacts/drafts) for the project.
export const replaceForProject = mutation({
  args: {
    projectId: v.id("projects"),
    companies: v.array(v.object({
      crustdataId: v.number(),
      name: v.string(),
      domain: v.optional(v.string()),
      segment: v.string(),
      data: v.any(),
      score: v.optional(v.number()),
      qualification: v.optional(v.any()),
      source,
    })),
  },
  handler: async (ctx, { projectId, companies }) => {
    for (const table of ["drafts", "contacts", "companies"] as const) {
      for await (const row of ctx.db.query(table).withIndex("by_projectId", (q) => q.eq("projectId", projectId))) {
        await ctx.db.delete(table, row._id);
      }
    }
    for (const company of companies) {
      await ctx.db.insert("companies", { ...company, projectId, selected: false });
    }
  },
});

export const setSelected = mutation({
  args: { id: v.id("companies"), selected: v.boolean() },
  handler: (ctx, { id, selected }) => ctx.db.patch("companies", id, { selected }),
});

// Scores arrive batch by batch during discovery, so prospects can be reviewed before scoring finishes.
export const setQualifications = mutation({
  args: {
    projectId: v.id("projects"),
    updates: v.array(v.object({ crustdataId: v.number(), score: v.number(), qualification: v.any() })),
  },
  handler: async (ctx, { projectId, updates }) => {
    const byCrustdataId = new Map(updates.map((u) => [u.crustdataId, u]));
    for await (const company of ctx.db.query("companies").withIndex("by_projectId", (q) => q.eq("projectId", projectId))) {
      const update = byCrustdataId.get(company.crustdataId);
      if (update) await ctx.db.patch("companies", company._id, { score: update.score, qualification: update.qualification });
    }
  },
});
