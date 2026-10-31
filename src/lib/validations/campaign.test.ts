import { describe, expect, it } from "vitest";
import { campaignInputSchema } from "./campaign";

const campaign = {
  name: " India launch ",
  product: "Sales intelligence",
  market: "Indian SaaS companies",
};

describe("campaign input", () => {
  it("normalizes whitespace before storing a campaign", () => {
    expect(campaignInputSchema.parse(campaign).name).toBe("India launch");
  });

  it.each(["name", "product", "market"] as const)("rejects blank %s", (field) => {
    expect(campaignInputSchema.safeParse({ ...campaign, [field]: "   " }).success).toBe(false);
  });

  it("bounds product descriptions before passing them to external APIs", () => {
    expect(campaignInputSchema.safeParse({ ...campaign, product: "x".repeat(2_001) }).success).toBe(false);
  });
});
