import { describe, expect, it } from "vitest";
import { buildCompanyQueries, dedupeCompanies } from "./crustdata-filters";
import { scoreQualification } from "./scoring";

describe("buildCompanyQueries", () => {
  it("builds one query per segment with shared geography and headcount bounds", () => {
    const queries = buildCompanyQueries(
      { minEmployees: 50, maxEmployees: 500 },
      [{ name: "Utilities", industries: ["Utilities"] }, { name: "Empty", industries: [] }],
      ["United Arab Emirates"],
    );
    expect(queries).toHaveLength(1);
    expect(queries[0].query.filters.conditions).toEqual([
      { field: "taxonomy.professional_network_industry", type: "in", value: ["Utilities"] },
      { field: "locations.country", type: "in", value: ["United Arab Emirates"] },
      { field: "headcount.total", type: ">", value: 49 },
      { field: "headcount.total", type: "<", value: 501 },
    ]);
  });

  it("omits headcount filters when the ICP has no size bounds", () => {
    const [q] = buildCompanyQueries({ minEmployees: null, maxEmployees: null }, [{ name: "A", industries: ["X"] }], []);
    expect(q.query.filters.conditions).toHaveLength(1);
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
    companyId: 1, icpFit: 55, useCaseRelevance: 20, observedSignals: 15, geography: 10,
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
    expect(scored.score).toBe(40 + 20 + 15 + 10);
  });

  it("zeroes observed signals when no evidence is supported", () => {
    const scored = scoreQualification({ ...base, evidence: [{ field: "hiring.openings", claim: "Hiring" }] }, company);
    expect(scored.observedSignals).toBe(0);
    expect(scored.score).toBe(40 + 20 + 0 + 10);
  });
});
