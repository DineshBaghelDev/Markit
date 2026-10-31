import { describe, expect, it } from "vitest";
import { isSimulatedSend, sampleReply } from "./sample-replies";

describe("sample replies", () => {
  it("only treats simulated message ids as demo sends", () => {
    expect(isSimulatedSend("simulated-123")).toBe(true);
    expect(isSimulatedSend("<abc@gmail.com>")).toBe(false);
    expect(isSimulatedSend(undefined)).toBe(false);
  });

  it("is deterministic, signs with the first name and leaves every fourth thread unanswered", () => {
    expect(sampleReply(0, "Amira Haddad", "Acme")).toEqual(sampleReply(0, "Amira Haddad", "Acme"));
    expect(sampleReply(0, "Amira Haddad", "Acme")?.body).toMatch(/at Acme[\s\S]*\nAmira$/);
    expect(sampleReply(2, "Amira Haddad", "Acme")).toBeNull();
    expect(sampleReply(5, "Amira", "Acme")?.kind).toBe("Referral");
  });
});
