import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { buildPeopleAtCompanyQuery } from "@/lib/crustdata-filters";
import { businessProfileSchema, icpSchema } from "@/lib/schemas";
import { pickDecisionMakers } from "@/lib/server/ai";
import { personSearch } from "@/lib/server/crustdata";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 300;

// Step 6: people at selected companies -> LLM picks those matching the product's buyer roles.
export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  const id = projectId as Id<"projects">;
  const project = await fetchQuery(api.projects.get, { id });
  if (!project) throw new Error("Project not found");
  const icp = icpSchema.parse(project.icp);
  const profile = businessProfileSchema.parse(project.profile);
  const selected = (await fetchQuery(api.companies.listByProject, { projectId: id })).filter((c) => c.selected);
  if (!selected.length) throw new Error("Select at least one company.");

  const perCompany = await Promise.all(selected.map(async (company) => {
    // Prefer people located in the target countries; fall back to any location if none are found.
    let { profiles, cached } = await personSearch(buildPeopleAtCompanyQuery(company.crustdataId, icp.countries));
    if (!profiles.length) ({ profiles, cached } = await personSearch(buildPeopleAtCompanyQuery(company.crustdataId)));
    const candidates = profiles.map((person) => {
      // A person can hold several current roles; use the one at this company.
      const role = person.experience?.employment_details?.current
        ?.find((r) => r.crustdata_company_id === company.crustdataId);
      return {
        person,
        personId: person.crustdata_person_id,
        name: person.basic_profile?.name ?? "Unknown",
        title: role?.title ?? person.basic_profile?.current_title ?? "",
      };
    });
    const picks = await pickDecisionMakers(profile, icp, company.name,
      candidates.map(({ personId, name, title }) => ({ personId, name, title })));

    return picks.flatMap((pick) => {
      const candidate = candidates.find((c) => c.personId === pick.personId);
      if (!candidate) return [];
      return [{
        companyId: company._id,
        crustdataPersonId: candidate.personId,
        name: candidate.name,
        title: candidate.title,
        profileUrl: candidate.person.social_handles?.professional_network_identifier?.profile_url ?? undefined,
        emailStatus: "not_enriched" as const,
        relevance: pick.relevance,
        source: cached ? "fixture" as const : "live" as const,
      }];
    });
  }));

  const contacts = perCompany.flat();
  await fetchMutation(api.contacts.replaceForProject, { projectId: id, contacts });
  const withoutContacts = selected.filter((_, i) => perCompany[i].length === 0).map((c) => c.name);
  return { count: contacts.length, withoutContacts };
});
