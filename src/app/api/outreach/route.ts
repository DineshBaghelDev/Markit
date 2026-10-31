import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { jsonRoute } from "@/lib/server/route";
import { writeDrafts } from "@/lib/server/pipeline";

export const maxDuration = 300;

// Step 7: drafts for selected contacts, or one contact when regenerating.
export const POST = jsonRoute(z.object({ projectId: z.string(), contactId: z.string().optional() }),
  ({ projectId, contactId }) => writeDrafts(projectId as Id<"projects">, contactId));
