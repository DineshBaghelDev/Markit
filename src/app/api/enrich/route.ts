import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { jsonRoute } from "@/lib/server/route";
import { enrichSelectedContacts } from "@/lib/server/pipeline";

export const maxDuration = 120;

// Business email enrichment for selected contacts only.
export const POST = jsonRoute(z.object({ projectId: z.string() }), ({ projectId }) =>
  enrichSelectedContacts(projectId as Id<"projects">));
