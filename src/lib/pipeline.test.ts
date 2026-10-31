import { describe, expect, it } from "vitest";
import { buildCompanyQueries, dedupeCompanies, MIN_EMPLOYEES_FLOOR } from "./crustdata-filters";
import { scoreQualification } from "./scoring";

describe("buildCompanyQueries", () => {
  it("uses semantic search per segment with shared geography and headcount bounds", () => {
    const queries = buildCompanyQueries(
      { minEmployees: 50, maxEmployees: 500 },
      [
        { name: "Cold chain", searchQuery: "Cold storage warehouse operator", industries: [] },
        { name: "Empty", searchQuery: "", industries: [] },
      ],
      ["United Arab Emirates"],
    );
    expect(queries).toHaveLength(1);
    expect(queries[0].query.search).toEqual({ query: "Cold storage warehouse operator", mode: "semantic" });
    expect(queries[0].query.filters.conditions).toEqual([
      { field: "locations.country", type: "in", value: ["United Arab Emirates"] },
      { field: "headcount.total", type: ">", value: 49 },
      { field: "headcount.total", type: "<", value: 501 },
    ]);
  });

  it("falls back to industry filters and applies the minimum size floor", () => {
    const [q] = buildCompanyQueries({ minEmployees: null, maxEmployees: null }, [{ name: "A", searchQuery: " ", industries: ["X"] }], []);
    expect(q.query.search).toBeUndefined();
    expect(q.query.filters.conditions).toEqual([
      { field: "taxonomy.professional_network_industry", type: "in", value: ["X"] },
      { field: "headcount.total", type: ">", value: MIN_EMPLOYEES_FLOOR - 1 },
    ]);
  });
});

describe("dedupeCompanies", () => {
  it("removes duplicates by id or domain", () => {
    const result = dedupeCompanies([
      { crustdata_company_id: 1, basic_info: { primary_domain: "a.com" } },
      { crustdata_company_id: 1, basic_info: { primary_domain: "b.com" } },
      { crustdata_company_id: 2, basic_info: { primary_domain: "A.com" } },
      { crustdata_company_id: 3, basic_info: null },
    ]);
    expect(result.map((c) => c.crustdata_company_id)).toEqual([1, 3]);
  });
});

describe("scoreQualification", () => {
  const company = { funding: { last_round_type: "series_a" }, hiring: null };
  const base = {
    companyId: 1, icpFit: 55, useCaseRelevance: 20, observedSignals: 30,
    reasons: [], missingInformation: [],
  };

  it("clamps sub-scores to the rubric and keeps only evidence present in the record", () => {
    const scored = scoreQualification({
      ...base,
      evidence: [
        { field: "funding.last_round_type", claim: "Recently funded" },
        { field: "hiring.openings", claim: "Hiring" },
      ],
    }, company);
    expect(scored.icpFit).toBe(40);
    expect(scored.evidence).toEqual([{ field: "funding.last_round_type", claim: "Recently funded", value: "series_a" }]);
    expect(scored.observedSignals).toBe(25);
    expect(scored.score).toBe(40 + 20 + 25);
  });

  it("zeroes observed signals when no evidence is supported", () => {
    const scored = scoreQualification({ ...base, evidence: [{ field: "hiring.openings", claim: "Hiring" }] }, company);
    expect(scored.observedSignals).toBe(0);
    expect(scored.score).toBe(40 + 20 + 0);
  });
});
