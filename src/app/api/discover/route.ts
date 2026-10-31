import { after } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { jsonRoute } from "@/lib/server/route";
import { discoverProspects } from "@/lib/server/pipeline";

export const maxDuration = 300;

// Steps 4-5: Crustdata discovery and qualification for the approved ICP. A live run takes minutes, so it runs in
// the background: this returns at once and the page follows the project status and the companies table live.
export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  const id = projectId as Id<"projects">;
  const project = await fetchQuery(api.projects.get, { id });
  if (!project) throw new Error("Project not found");
  if (!project.icpApproved) throw new Error("Approve the ICP before discovering companies.");
  if (!(await fetchMutation(api.projects.startRun, { id, status: "discovering" }))) {
    throw new Error("A search is already running for this project.");
  }
  after(() => discoverProspects(id).catch((error) => console.error("[discover]", error)));
  return { started: true };
});
