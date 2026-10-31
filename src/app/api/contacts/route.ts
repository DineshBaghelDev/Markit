import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { jsonRoute } from "@/lib/server/route";
import { findDecisionMakers } from "@/lib/server/pipeline";

export const maxDuration = 300;

// Step 6: decision-makers at the selected companies.
export const POST = jsonRoute(z.object({ projectId: z.string() }), ({ projectId }) =>
  findDecisionMakers(projectId as Id<"projects">));
