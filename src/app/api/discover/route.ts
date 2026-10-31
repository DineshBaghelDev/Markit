import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { jsonRoute } from "@/lib/server/route";
import { discoverProspects } from "@/lib/server/pipeline";

export const maxDuration = 300;

// Steps 4-5: Crustdata discovery and qualification for the approved ICP.
export const POST = jsonRoute(z.object({ projectId: z.string() }), ({ projectId }) =>
  discoverProspects(projectId as Id<"projects">));
