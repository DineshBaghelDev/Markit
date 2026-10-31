import { fetchMutation } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { DEMO_TEMPLATE_ID } from "@/lib/server/demo-template";
import { jsonRoute } from "@/lib/server/route";

// Deletes a project with its companies, contacts and drafts. The guided-example template is protected because
// "Use example" replays it. Deleting costs nothing, so it is not rate-limited.
export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  // Fail closed: if the template id is ever missing, refuse rather than risk deleting it.
  if (!DEMO_TEMPLATE_ID || projectId === DEMO_TEMPLATE_ID) {
    throw new Error("The example template can't be deleted; the guided example replays it.");
  }
  await fetchMutation(api.projects.remove, { id: projectId as Id<"projects"> });
}, null);
