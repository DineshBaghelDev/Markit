import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  campaigns: defineTable({
    name: v.string(),
    product: v.string(),
    market: v.string(),
    createdAt: v.number(),
  }).index("by_created_at", ["createdAt"]),
});
