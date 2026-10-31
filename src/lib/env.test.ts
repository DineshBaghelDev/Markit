import { describe, expect, it, afterEach, vi } from "vitest";
import { publicEnvSchema, requireServerEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("environment configuration", () => {
  it("allows the starter to run without a Convex deployment", () => {
    expect(publicEnvSchema.parse({ NEXT_PUBLIC_CONVEX_URL: "" }).NEXT_PUBLIC_CONVEX_URL).toBeUndefined();
  });

  it("rejects malformed deployment URLs", () => {
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_CONVEX_URL: "not-a-url" }).success).toBe(false);
  });

  it("reports a missing credential by name without exposing its value", () => {
    vi.stubEnv("CRUSTDATA_API_KEY", "");
    expect(() => requireServerEnv("CRUSTDATA_API_KEY")).toThrow("Missing required environment variable: CRUSTDATA_API_KEY");
  });
});
