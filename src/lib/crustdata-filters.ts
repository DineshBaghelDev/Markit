import type { Icp } from "@/lib/schemas";

type Condition = { field: string; type: string; value: unknown };
export type CompanySearchQuery = {
  filters: { op: "and"; conditions: Condition[] };
  limit: number;
};
export type PersonSearchQuery = CompanySearchQuery;

export type ResolvedSegment = { name: string; industries: string[] };

// One query per ICP segment, using only indexed values resolved through autocomplete.
export function buildCompanyQueries(
  icp: Pick<Icp, "minEmployees" | "maxEmployees">,
  segments: ResolvedSegment[],
  countries: string[],
  limitPerSegment = 10,
): { segment: string; query: CompanySearchQuery }[] {
  const shared: Condition[] = [];
  if (countries.length) shared.push({ field: "locations.country", type: "in", value: countries });
  if (icp.minEmployees && icp.minEmployees > 0) {
    shared.push({ field: "headcount.total", type: ">", value: icp.minEmployees - 1 });
  }
  if (icp.maxEmployees && icp.maxEmployees > 0) {
    shared.push({ field: "headcount.total", type: "<", value: icp.maxEmployees + 1 });
  }

  return segments
    .filter((segment) => segment.industries.length > 0)
    .map((segment) => ({
      segment: segment.name,
      query: {
        filters: {
          op: "and",
          conditions: [
            { field: "taxonomy.professional_network_industry", type: "in", value: segment.industries },
            ...shared,
          ],
        },
        limit: limitPerSegment,
      },
    }));
}

export function buildPeopleAtCompanyQuery(crustdataCompanyId: number, limit = 20): PersonSearchQuery {
  return {
    filters: {
      op: "and",
      conditions: [{ field: "experience.employment_details.current.company_id", type: "=", value: crustdataCompanyId }],
    },
    limit,
  };
}

export function dedupeCompanies<T extends { crustdata_company_id: number; basic_info?: { primary_domain?: string | null } | null }>(
  companies: T[],
): T[] {
  const seen = new Set<string>();
  return companies.filter((company) => {
    const domain = company.basic_info?.primary_domain?.toLowerCase();
    const keys = [`id:${company.crustdata_company_id}`, ...(domain ? [`domain:${domain}`] : [])];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
