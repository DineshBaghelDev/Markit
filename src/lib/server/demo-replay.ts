import "server-only";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { ParsedBusinessInput } from "@/lib/schemas";
import { DEMO_TEMPLATE_ID } from "@/lib/server/demo-template";
import { draftTargets } from "@/lib/draft-targets";

// Guided example: when the "Use example" input arrives unchanged, each step replays the matching result from a
// completed template project stored in Convex (so it also works on Vercel), after a short pause that lets the
// progress animation play. Any edited or new input runs the live pipeline.

export const demoPause = () => new Promise((resolve) => setTimeout(resolve, 2_500 + Math.random() * 1_000));

export async function demoTemplateFor(input: ParsedBusinessInput) {
  if (input.documents.length) return null;
  const template = await fetchQuery(api.projects.get, { id: DEMO_TEMPLATE_ID }).catch(() => null);
  const t = template?.input as ParsedBusinessInput | undefined;
  if (!template || !t) return null;
  const same = (a?: string, b?: string) => (a ?? "").trim() === (b ?? "").trim();
  return same(input.product, t.product) && same(input.companyName, t.companyName) && same(input.geography, t.geography) ? template : null;
}

export async function replayCompanies(project: Doc<"projects">) {
  const companies = await fetchQuery(api.companies.listByProject, { projectId: project.demoOf! });
  await fetchMutation(api.companies.replaceForProject, {
    projectId: project._id,
    companies: companies.map(({ crustdataId, name, domain, segment, data, score, qualification, source }) =>
      ({ crustdataId, name, domain, segment, data, score, qualification, source })),
  });
  return companies.length;
}

export async function replayContacts(project: Doc<"projects">) {
  const templateId = project.demoOf!;
  const [mine, theirs, theirContacts] = await Promise.all([
    fetchQuery(api.companies.listByProject, { projectId: project._id }),
    fetchQuery(api.companies.listByProject, { projectId: templateId }),
    fetchQuery(api.contacts.listByProject, { projectId: templateId }),
  ]);
  const selected = mine.filter((c) => c.selected);
  if (!selected.length) throw new Error("Select at least one company.");
  const contacts = selected.flatMap((company) => {
    const twin = theirs.find((t) => t.crustdataId === company.crustdataId);
    return theirContacts.filter((c) => c.companyId === twin?._id && c.source !== "manual").map((c) => ({
      companyId: company._id, crustdataPersonId: c.crustdataPersonId, name: c.name, title: c.title,
      profileUrl: c.profileUrl, emailStatus: "not_enriched" as const, relevance: c.relevance, source: c.source,
    }));
  });
  if (!contacts.length) {
    const recorded = theirs.filter((t) => theirContacts.some((c) => c.companyId === t._id)).map((t) => t.name);
    throw new Error(`The recorded example has decision-makers only for ${recorded.join(", ")}. Select one of those to continue.`);
  }
  await fetchMutation(api.contacts.replaceForProject, { projectId: project._id, contacts });
  return contacts.length;
}

export async function replayDrafts(project: Doc<"projects">, contactId?: string) {
  const templateId = project.demoOf!;
  const [mine, myDrafts, theirContacts, theirDrafts] = await Promise.all([
    fetchQuery(api.contacts.listByProject, { projectId: project._id }),
    fetchQuery(api.drafts.listByProject, { projectId: project._id }),
    fetchQuery(api.contacts.listByProject, { projectId: templateId }),
    fetchQuery(api.drafts.listByProject, { projectId: templateId }),
  ]);
  const targets = draftTargets(mine, myDrafts, contactId);
  let count = 0;
  for (const contact of targets) {
    const twin = theirContacts.find((c) => c.crustdataPersonId === contact.crustdataPersonId);
    const draft = theirDrafts.find((d) => d.contactId === twin?._id);
    if (!draft) continue;
    await fetchMutation(api.drafts.upsert, {
      projectId: project._id, contactId: contact._id, subject: draft.subject, body: draft.body,
      cta: draft.cta, valueProposition: draft.valueProposition, citations: draft.citations ?? [],
    });
    count++;
  }
  return count;
}
