import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {},
  returns: v.object({ status: v.literal("ok") }),
  handler: async () => ({ status: "ok" as const }),
});
