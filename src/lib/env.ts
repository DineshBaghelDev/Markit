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

// AI Gateway model string ("provider/model"). Gateway auth comes from AI_GATEWAY_API_KEY or Vercel OIDC.
export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || "openai/gpt-5-mini";
}
