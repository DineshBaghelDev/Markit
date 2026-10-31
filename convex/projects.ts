import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isActiveRun } from "./runState";

export const create = mutation({
  args: { input: v.any(), profile: v.any(), icp: v.any(), insights: v.any(), demoOf: v.optional(v.id("projects")) },
  handler: (ctx, args) => ctx.db.insert("projects", { ...args, icpApproved: false, status: "strategy_ready", statusAt: Date.now() }),
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

export const rename = mutation({
  args: { id: v.id("projects"), name: v.string() },
  handler: (ctx, { id, name }) => ctx.db.patch("projects", id, { name: name.trim() || undefined }),
});

// Profile corrections from the Business step. Later steps read the profile when they run.
export const updateProfile = mutation({
  args: { id: v.id("projects"), profile: v.any() },
  handler: (ctx, { id, profile }) => ctx.db.patch("projects", id, { profile }),
});

// Approving during a background run (autopilot) keeps the run's status.
export const approveIcp = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const project = await ctx.db.get("projects", id);
    if (!project) throw new Error("Project not found");
    if (isActiveRun(project.status, project.statusAt, Date.now())) return ctx.db.patch("projects", id, { icpApproved: true });
    await ctx.db.patch("projects", id, { icpApproved: true, status: "icp_approved", statusAt: Date.now() });
  },
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
  handler: (ctx, { id, status, error }) => ctx.db.patch("projects", id, { status, error, statusAt: Date.now() }),
});

// Atomically claims a project for a background run, so double clicks or two open tabs start only one run.
// With `from`, the project must be in exactly that status (autopilot hand-offs); otherwise it must not have an
// active run. A run whose status went stale (the function died) can be claimed again.
export const startRun = mutation({
  args: { id: v.id("projects"), status: v.string(), from: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (ctx, { id, status, from }) => {
    const project = await ctx.db.get("projects", id);
    if (!project) throw new Error("Project not found");
    if (from !== undefined ? project.status !== from : isActiveRun(project.status, project.statusAt, Date.now())) return false;
    // An autopilot hand-off keeps the run log carried in `error`; a fresh run clears old notes.
    await ctx.db.patch("projects", id, { status, error: from !== undefined ? project.error : undefined, statusAt: Date.now() });
    return true;
  },
});
