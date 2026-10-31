import { z } from "zod";
import type { Id } from "../../../../convex/_generated/dataModel";
import { sendApprovedDrafts } from "@/lib/server/pipeline";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 120;

// Step 8: send approved drafts (all, or the given ids) via Gmail to allowlisted recipients only.
export const POST = jsonRoute(z.object({ projectId: z.string(), draftIds: z.array(z.string()).optional() }),
  ({ projectId, draftIds }) => sendApprovedDrafts(projectId as Id<"projects">, draftIds), "send");
