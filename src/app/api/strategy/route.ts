import { createProject } from "@/lib/server/pipeline";
import { businessInputRoute } from "@/lib/server/route";

export const maxDuration = 120;

// Steps 1-3: business understanding, ICP and market insights (JSON, or multipart with seller documents).
export const POST = businessInputRoute(async (input) => ({ projectId: await createProject(input) }));
