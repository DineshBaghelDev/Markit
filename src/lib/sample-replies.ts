// Demo inbox: illustrative replies for simulated sends only. They are never written by the contacts and the UI
// labels them as samples. Real (Gmail) sends never get a sample reply.
export type SampleReply = { kind: "Interested" | "Referral" | "Not now"; body: string };

export const isSimulatedSend = (messageId?: string) => !!messageId?.startsWith("simulated-");

// Deterministic by position, so the inbox looks the same on every visit. Every fourth thread has no reply.
export function sampleReply(index: number, contactName: string, companyName: string): SampleReply | null {
  const first = contactName.trim().split(/\s+/)[0] || "there";
  const company = companyName || "our company";
  switch (index % 4) {
    case 0:
      return { kind: "Interested", body: `Hi,\n\nThanks for reaching out. This is relevant for us at ${company} right now. Could you send a short overview with typical pricing? If it fits, I'm happy to set up a call the week after.\n\nBest,\n${first}` };
    case 1:
      return { kind: "Referral", body: `Hi,\n\nThanks for the note. I'm not the right person for this at ${company}. Our operations lead owns this area, and I've forwarded your email to them.\n\nRegards,\n${first}` };
    case 3:
      return { kind: "Not now", body: `Hi,\n\nAppreciate it. Our plans are fixed until next quarter, so the timing isn't right. Feel free to reach out again then.\n\nThanks,\n${first}` };
    default:
      return null;
  }
}
