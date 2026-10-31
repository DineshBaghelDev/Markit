import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { businessInputSchema } from "@/lib/schemas";
import { generateStrategy } from "@/lib/server/ai";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 120;

// Steps 1-3: business understanding, ICP and market insights in one model call.
export const POST = jsonRoute(businessInputSchema, async (input) => {
  const strategy = await generateStrategy(input);
  const projectId = await fetchMutation(api.projects.create, { input, ...strategy });
  return { projectId };
});
