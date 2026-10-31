import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { createProject } from "@/lib/server/pipeline";
import { businessInputRoute } from "@/lib/server/route";

export const maxDuration = 300;

// Autopilot mode: build the strategy now, then queue the remaining stages. The project page starts each stage
// through /api/autopilot/continue, so every stage gets its own function time budget.
export const POST = businessInputRoute(async (input) => {
  const projectId = await createProject(input);
  await fetchMutation(api.projects.setStatus, { id: projectId, status: "autopilot_queued" });
  return { projectId };
});
