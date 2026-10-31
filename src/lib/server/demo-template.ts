import "server-only";

import type { Id } from "../../../convex/_generated/dataModel";

// The completed project that the guided example ("Use example") replays. Override with DEMO_TEMPLATE_PROJECT_ID.
export const DEMO_TEMPLATE_ID = (process.env.DEMO_TEMPLATE_PROJECT_ID?.trim() || "jn75fbnkx8rkxhp34e76e5vkfs8ha0tq") as Id<"projects">;
