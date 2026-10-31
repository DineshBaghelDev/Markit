import { z } from "zod";

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a campaign name.").max(100),
  product: z.string().trim().min(1, "Describe your product.").max(2_000),
  market: z.string().trim().min(1, "Enter a target market.").max(500),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
