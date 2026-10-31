import { after } from "next/server";
import { createProject, runAutopilot } from "@/lib/server/pipeline";
import { businessInputRoute } from "@/lib/server/route";

export const maxDuration = 800;

// Autopilot mode: create the project, then run every remaining step in the background.
// Progress is written to the project's status in Convex, so the UI follows it live.
export const POST = businessInputRoute(async (input) => {
  const projectId = await createProject(input);
  after(() => runAutopilot(projectId).catch((error) => console.error("[autopilot]", error)));
  return { projectId };
});
