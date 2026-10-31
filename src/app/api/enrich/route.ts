import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { enrichBusinessEmails } from "@/lib/server/crustdata";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 120;

// Spend enrichment credits only on selected contacts with a profile URL. Missing emails stay missing.
export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  const contacts = (await fetchQuery(api.contacts.listByProject, { projectId: projectId as Id<"projects"> }))
    .filter((c) => c.selected && c.emailStatus === "not_enriched");
  const urls = contacts.flatMap((c) => (c.profileUrl ? [c.profileUrl] : []));
  const emails = urls.length ? await enrichBusinessEmails(urls) : new Map<string, string>();
  await fetchMutation(api.contacts.setEmails, {
    updates: contacts.map((c) => ({ id: c._id, email: c.profileUrl ? emails.get(c.profileUrl) : undefined })),
  });
  return { enriched: emails.size, requested: contacts.length };
});
