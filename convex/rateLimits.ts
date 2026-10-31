import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";

// Protects paid LLM/Crustdata calls and email sending. Limits are stored in Convex, so they hold across
// every serverless instance. Per-client buckets allow a short burst (a full guided demo run fits) and a
// global window caps total spend if many clients arrive at once.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  pipelinePerClient: { kind: "token bucket", rate: 30, period: HOUR, capacity: 12 },
  pipelineGlobal: { kind: "fixed window", rate: 300, period: HOUR },
  sendPerClient: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  sendGlobal: { kind: "fixed window", rate: 20, period: 10 * MINUTE },
});

// Called by the Next.js API routes with the caller's IP as the key. Checks both limits before consuming either,
// so a request refused by the global cap does not also use up the client's budget.
export const consume = mutation({
  args: { bucket: v.union(v.literal("pipeline"), v.literal("send")), key: v.string() },
  returns: v.object({ ok: v.boolean(), retryAfter: v.number() }),
  handler: async (ctx, { bucket, key }) => {
    const perClient = `${bucket}PerClient` as const;
    const global = `${bucket}Global` as const;
    for (const [name, opts] of [[perClient, { key }], [global, {}]] as const) {
      const status = await rateLimiter.check(ctx, name, opts);
      if (!status.ok) return { ok: false, retryAfter: status.retryAfter ?? MINUTE };
    }
    await rateLimiter.limit(ctx, perClient, { key });
    await rateLimiter.limit(ctx, global);
    return { ok: true, retryAfter: 0 };
  },
});
