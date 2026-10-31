import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { input: v.any(), profile: v.any(), icp: v.any(), insights: v.any() },
  handler: (ctx, args) => ctx.db.insert("projects", { ...args, icpApproved: false, status: "strategy_ready" }),
});

export const get = query({
  args: { id: v.id("projects") },
  handler: (ctx, { id }) => ctx.db.get("projects", id),
});

export const list = query({
  args: {},
  handler: (ctx) => ctx.db.query("projects").order("desc").take(20),
});

// Editing the ICP clears approval so search criteria are only frozen by an explicit approval.
export const updateIcp = mutation({
  args: { id: v.id("projects"), icp: v.any() },
  handler: (ctx, { id, icp }) => ctx.db.patch("projects", id, { icp, icpApproved: false }),
});

export const approveIcp = mutation({
  args: { id: v.id("projects") },
  handler: (ctx, { id }) => ctx.db.patch("projects", id, { icpApproved: true, status: "icp_approved" }),
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    for (const table of ["drafts", "contacts", "companies"] as const) {
      for await (const row of ctx.db.query(table).withIndex("by_projectId", (q) => q.eq("projectId", id))) {
        await ctx.db.delete(table, row._id);
      }
    }
    await ctx.db.delete("projects", id);
  },
});

export const setStatus = mutation({
  args: { id: v.id("projects"), status: v.string(), error: v.optional(v.string()) },
  handler: (ctx, { id, status, error }) => ctx.db.patch("projects", id, { status, error }),
});
