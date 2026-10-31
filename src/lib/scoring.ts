import type { Qualification } from "@/lib/schemas";

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

export function getPath(record: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, record);
}

const isPresent = (value: unknown) =>
  value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

export type ScoredQualification = Omit<Qualification, "evidence"> & {
  score: number;
  evidence: { field: string; claim: string; value: string }[];
};

// Fixed rubric: ICP fit 40, use case 35, observed signals 25. Geography is enforced by the search filter, not scored.
// Evidence is kept only when it points at a field actually present in the returned record.
export function scoreQualification(q: Qualification, company: unknown): ScoredQualification {
  const evidence = q.evidence
    .map((e) => ({ ...e, raw: getPath(company, e.field) }))
    .filter((e) => isPresent(e.raw))
    .map(({ raw, ...e }) => ({ ...e, value: (typeof raw === "string" ? raw : JSON.stringify(raw)).slice(0, 200) }));

  const icpFit = clamp(q.icpFit, 40);
  const useCaseRelevance = clamp(q.useCaseRelevance, 35);
  // No supported evidence means no observed signal can be claimed.
  const observedSignals = evidence.length ? clamp(q.observedSignals, 25) : 0;

  return {
    ...q,
    icpFit,
    useCaseRelevance,
    observedSignals,
    evidence,
    score: icpFit + useCaseRelevance + observedSignals,
  };
}
