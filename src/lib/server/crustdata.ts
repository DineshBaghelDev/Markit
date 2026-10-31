import "server-only";

import { z } from "zod";
import { requireServerEnv } from "@/lib/env";

const creditsSchema = z.object({
  account: z.object({ credits: z.number() }),
});

// Free account endpoint for verifying the integration without consuming credits.
export async function getCrustdataCredits(): Promise<number> {
  const response = await fetch("https://api.crustdata.com/account/credits", {
    headers: {
      Authorization: `Bearer ${requireServerEnv("CRUSTDATA_API_KEY")}`,
      "x-api-version": "2025-11-01",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Crustdata request failed (HTTP ${response.status})`);
  }

  return creditsSchema.parse(await response.json()).account.credits;
}
