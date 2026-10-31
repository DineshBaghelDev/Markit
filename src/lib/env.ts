import { z } from "zod";

const requiredSecret = z.string().trim().min(1);
const optionalUrl = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.url().optional(),
);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: optionalUrl,
});

// Validate credentials when an integration is used, not during an unrelated build.
export function requireServerEnv(name: "CRUSTDATA_API_KEY"): string {
  const result = requiredSecret.safeParse(process.env[name]);
  if (!result.success) throw new Error(`Missing required environment variable: ${name}`);
  return result.data;
}

// LLM_BASE_URL selects an OpenAI-compatible server (e.g. local codex-as-api);
// otherwise AI_MODEL is a Vercel AI Gateway "provider/model" string.
export function llmConfig() {
  const baseURL = process.env.LLM_BASE_URL?.trim() || undefined;
  const model = process.env.AI_MODEL?.trim() || (baseURL ? "gpt-6.1-sol" : "openai/gpt-5-mini");
  return { baseURL, model, apiKey: process.env.LLM_API_KEY?.trim() || "local" };
}
