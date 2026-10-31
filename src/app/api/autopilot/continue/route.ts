import { after } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { runAutopilotDiscovery, runAutopilotOutreach } from "@/lib/server/pipeline";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 300;

// Starts the next autopilot stage in the background. The claim (startRun with `from`) is atomic, so repeated
// calls from several tabs start each stage once; a call with nothing to start is a no-op.
const STAGES = {
  autopilot_queued: { next: "discovering", run: runAutopilotDiscovery },
  autopilot_prospects: { next: "autopilot_contacts", run: runAutopilotOutreach },
} as const;

export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  const id = projectId as Id<"projects">;
  const project = await fetchQuery(api.projects.get, { id });
  if (!project) throw new Error("Project not found");
  const stage = STAGES[project.status as keyof typeof STAGES];
  if (!stage) return { started: false };
  const claimed = await fetchMutation(api.projects.startRun, { id, status: stage.next, from: project.status });
  if (claimed) after(() => stage.run(id).catch((error) => console.error("[autopilot]", error)));
  return { started: claimed };
});
