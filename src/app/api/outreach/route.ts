import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { businessProfileSchema, icpSchema } from "@/lib/schemas";
import { generateDraft } from "@/lib/server/ai";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 300;

// Step 7: one personalised draft per selected contact, or a single contact when regenerating.
export const POST = jsonRoute(
  z.object({ projectId: z.string(), contactId: z.string().optional() }),
  async ({ projectId, contactId }) => {
    const id = projectId as Id<"projects">;
    const project = await fetchQuery(api.projects.get, { id });
    if (!project) throw new Error("Project not found");
    const profile = businessProfileSchema.parse(project.profile);
    const icp = icpSchema.parse(project.icp);
    const [companies, contacts] = await Promise.all([
      fetchQuery(api.companies.listByProject, { projectId: id }),
      fetchQuery(api.contacts.listByProject, { projectId: id }),
    ]);
    const targets = contacts.filter((c) => (contactId ? c._id === contactId : c.selected));
    if (!targets.length) throw new Error("Select at least one contact.");

    await Promise.all(targets.map(async (contact) => {
      const company = companies.find((c) => c._id === contact.companyId);
      const draft = await generateDraft({
        profile,
        icp,
        company: company?.data,
        qualification: company?.qualification,
        contact: { name: contact.name, title: contact.title, relevance: contact.relevance },
      });
      await fetchMutation(api.drafts.upsert, { projectId: id, contactId: contact._id, ...draft });
    }));
    return { count: targets.length };
  },
);
