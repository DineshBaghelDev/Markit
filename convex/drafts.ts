import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { draftStatus } from "./schema";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: (ctx, { projectId }) =>
    ctx.db.query("drafts").withIndex("by_projectId", (q) => q.eq("projectId", projectId)).take(300),
});

// One draft per contact; regenerating replaces the content and resets approval.
export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    subject: v.string(),
    body: v.string(),
    cta: v.string(),
    valueProposition: v.string(),
    citations: v.array(v.object({ field: v.string(), statement: v.string(), value: v.string() })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("drafts").withIndex("by_contactId", (q) => q.eq("contactId", args.contactId)).unique();
    if (existing?.status === "sent") throw new Error("This email was already sent; it cannot be regenerated.");
    if (existing) await ctx.db.patch("drafts", existing._id, { ...args, status: "draft" });
    else await ctx.db.insert("drafts", { ...args, status: "draft" });
  },
});

export const update = mutation({
  args: {
    id: v.id("drafts"),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    status: v.optional(draftStatus),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    // Content edits invalidate a prior approval.
    if ((fields.subject !== undefined || fields.body !== undefined) && fields.status === undefined) patch.status = "draft";
    await ctx.db.patch("drafts", id, patch);
  },
});

export const setStatusMany = mutation({
  args: { ids: v.array(v.id("drafts")), status: draftStatus },
  handler: async (ctx, { ids, status }) => {
    for (const id of ids) await ctx.db.patch("drafts", id, { status });
  },
});

// Set only after the email provider confirms delivery to the outgoing server.
export const markSent = mutation({
  args: { id: v.id("drafts"), messageId: v.string() },
  handler: (ctx, { id, messageId }) => ctx.db.patch("drafts", id, { status: "sent", messageId, sentAt: Date.now() }),
});
