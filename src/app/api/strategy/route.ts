import { businessInputSchema } from "@/lib/schemas";
import { createProject } from "@/lib/server/pipeline";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 120;

// Steps 1-3: business understanding, ICP and market insights.
export const POST = jsonRoute(businessInputSchema, async (input) => ({ projectId: await createProject(input) }));
