import { fetchMutation, fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { buildCompanyQueries, dedupeCompanies } from "@/lib/crustdata-filters";
import { businessProfileSchema, icpSchema } from "@/lib/schemas";
import { scoreQualification } from "@/lib/scoring";
import { qualifyCompanies } from "@/lib/server/ai";
import { companyAutocomplete, companySearch, type CrustdataCompany } from "@/lib/server/crustdata";
import { jsonRoute } from "@/lib/server/route";

export const maxDuration = 300;

// Record fields worth sending to the model; logos and timestamps are dropped.
function compact(company: CrustdataCompany) {
  const { basic_info, headcount, funding, locations, taxonomy, revenue, hiring, followers } =
    company as Record<string, unknown>;
  const info = { ...(basic_info as Record<string, unknown> | undefined) };
  delete info.logo_permalink;
  // Long descriptions add tokens and latency without changing the assessment much.
  if (typeof info.description === "string") info.description = info.description.slice(0, 700);
  return {
    crustdata_company_id: company.crustdata_company_id,
    basic_info: info, headcount, funding, locations, taxonomy, revenue, hiring, followers,
  };
}

// Steps 4-5: ICP -> Crustdata filters -> search -> dedupe -> LLM qualification -> stored ranked prospects.
export const POST = jsonRoute(z.object({ projectId: z.string() }), async ({ projectId }) => {
  const id = projectId as Id<"projects">;
  const project = await fetchQuery(api.projects.get, { id });
  if (!project) throw new Error("Project not found");
  if (!project.icpApproved) throw new Error("Approve the ICP before discovering companies.");
  const icp = icpSchema.parse(project.icp);
  const profile = businessProfileSchema.parse(project.profile);

  await fetchMutation(api.projects.setStatus, { id, status: "discovering" });
  try {
    // Translate free-text ICP values into exact indexed Crustdata values; unmatched values are dropped.
    const countries = [...new Set((await Promise.all(
      icp.countries.map((c) => companyAutocomplete("locations.country", c, 1)),
    )).flat())];
    // Industry autocomplete is only needed for segments without a semantic search description.
    const segments = await Promise.all(icp.segments.map(async (segment) => ({
      name: segment.name,
      searchQuery: segment.searchQuery,
      industries: segment.searchQuery.trim() ? [] : [...new Set((await Promise.all(
        segment.industries.map((i) => companyAutocomplete("taxonomy.professional_network_industry", i, 2)),
      )).flat())],
    })));

    const queries = buildCompanyQueries(icp, segments, countries);
    if (!queries.length) throw new Error("No ICP segment could be searched. Add a search description or industries.");
    const results = await Promise.all(queries.map(async ({ segment, query }) =>
    {
      const { companies, cached } = await companySearch(query);
      return companies.map((company) => ({ ...company, segment, cached }));
    }));
    const unique = dedupeCompanies(results.flat());

    const records = unique.map(compact);
    const BATCH = 12;
    const batches = Array.from({ length: Math.ceil(records.length / BATCH) }, (_, i) => records.slice(i * BATCH, (i + 1) * BATCH));
    const qualifications = (await Promise.all(batches.map((b) => qualifyCompanies(profile, icp, b)))).flat();
    const byId = new Map(qualifications.map((q) => [q.companyId, q]));

    const companies = unique.map((company, index) => {
      const q = byId.get(company.crustdata_company_id);
      const scored = q ? scoreQualification(q, records[index]) : undefined;
      return {
        crustdataId: company.crustdata_company_id,
        name: company.basic_info?.name ?? `Company ${company.crustdata_company_id}`,
        domain: company.basic_info?.primary_domain ?? undefined,
        segment: company.segment,
        data: records[index],
        score: scored?.score,
        qualification: scored,
        source: company.cached ? "fixture" as const : "live" as const,
      };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    await fetchMutation(api.companies.replaceForProject, { projectId: id, companies });
    await fetchMutation(api.projects.setStatus, { id, status: "prospects_ready" });
    return { count: companies.length, queries: queries.map((q) => q.query) };
  } catch (error) {
    await fetchMutation(api.projects.setStatus, {
      id, status: "error", error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});
