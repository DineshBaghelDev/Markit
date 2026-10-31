import type { Icp } from "@/lib/schemas";

type Condition = { field: string; type: string; value: unknown };
export type CompanySearchQuery = {
  search?: { query: string; mode: "semantic" };
  filters: { op: "and"; conditions: Condition[] };
  limit: number;
};
export type PersonSearchQuery = Omit<CompanySearchQuery, "search">;

// Companies below this size rarely have a buying process worth outbound effort.
export const MIN_EMPLOYEES_FLOOR = 10;

export type SearchSegment = { name: string; searchQuery: string; industries: string[] };

// One query per ICP segment. Semantic search on the segment description ranks companies by relevance;
// industry filters (autocomplete-resolved) are only used when a segment has no search description.
export function buildCompanyQueries(
  icp: Pick<Icp, "minEmployees" | "maxEmployees">,
  segments: SearchSegment[],
  countries: string[],
  limitPerSegment = 15,
): { segment: string; query: CompanySearchQuery }[] {
  const shared: Condition[] = [];
  if (countries.length) shared.push({ field: "locations.country", type: "in", value: countries });
  const min = Math.max(icp.minEmployees ?? 0, MIN_EMPLOYEES_FLOOR);
  shared.push({ field: "headcount.total", type: ">", value: min - 1 });
  if (icp.maxEmployees && icp.maxEmployees > min) {
    shared.push({ field: "headcount.total", type: "<", value: icp.maxEmployees + 1 });
  }

  return segments.flatMap((segment) => {
    const query = segment.searchQuery.trim();
    if (query) {
      return [{
        segment: segment.name,
        query: { search: { query, mode: "semantic" as const }, filters: { op: "and" as const, conditions: shared }, limit: limitPerSegment },
      }];
    }
    if (!segment.industries.length) return [];
    return [{
      segment: segment.name,
      query: {
        filters: {
          op: "and" as const,
          conditions: [{ field: "taxonomy.professional_network_industry", type: "in", value: segment.industries }, ...shared],
        },
        limit: limitPerSegment,
      },
    }];
  });
}

// Crustdata seniority values (from /person/search/autocomplete) of people who can own or sponsor a purchase.
export const DECISION_MAKER_SENIORITY = ["CXO", "Vice President", "Director", "Owner / Partner", "Experienced Manager"];

export function buildPeopleAtCompanyQuery(crustdataCompanyId: number, countries: string[] = [], limit = 25): PersonSearchQuery {
  const conditions: Condition[] = [
    { field: "experience.employment_details.current.company_id", type: "=", value: crustdataCompanyId },
    { field: "experience.employment_details.current.seniority_level", type: "in", value: DECISION_MAKER_SENIORITY },
  ];
  if (countries.length) conditions.push({ field: "basic_profile.location.country", type: "in", value: countries });
  return { filters: { op: "and", conditions }, limit };
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
