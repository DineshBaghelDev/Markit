import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { emailStatus, source } from "./schema";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, { projectId }) =>
    ctx.db.query("contacts").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(300),
});

// A new decision-maker run replaces earlier contacts and drafts for the project.
export const replaceForProject = mutation({
  args: {
    projectId: v.id("projects"),
    contacts: v.array(v.object({
      companyId: v.id("companies"),
      crustdataPersonId: v.number(),
      name: v.string(),
      title: v.string(),
      profileUrl: v.optional(v.string()),
      emailStatus,
      relevance: v.string(),
      source,
    })),
  },
  handler: async (ctx, { projectId, contacts }) => {
    for (const table of ["drafts", "contacts"] as const) {
      for await (const row of ctx.db.query(table).withIndex("by_projectId", (q) => q.eq("projectId", projectId))) {
        await ctx.db.delete(table, row._id);
      }
    }
    for (const contact of contacts) {
      await ctx.db.insert("contacts", { ...contact, projectId, selected: false });
    }
  },
});

export const setSelected = mutation({
  args: { id: v.id("contacts"), selected: v.boolean() },
  handler: (ctx, { id, selected }) => ctx.db.patch("contacts", id, { selected }),
});

export const setEmails = mutation({
  args: { updates: v.array(v.object({ id: v.id("contacts"), email: v.optional(v.string()) })) },
  handler: async (ctx, { updates }) => {
    for (const { id, email } of updates) {
      await ctx.db.patch("contacts", id, email ? { email, emailStatus: "enriched" } : { emailStatus: "unavailable" });
    }
  },
});
