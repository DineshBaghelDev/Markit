"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { icpSchema, type Icp, type Insights } from "@/lib/schemas";
import { ActionBar, EmptyState, ErrorNote, Icons, StatusChip, StepHeader } from "@/components/markit/app-shell";

// Fixed qualification rubric used by the scoring code (src/lib/scoring.ts).
export const RUBRIC = [["ICP fit", "icpFit", 40], ["Use-case relevance", "useCaseRelevance", 35], ["Observed signals", "observedSignals", 25]] as const;

type Field = "segments" | "size" | "geo" | "signals" | "roles" | "excl" | "rubric";

export function StrategyStep({ project, hasCompanies, busy, error, onApproveAndSearch, onSearch, onViewProspects }: {
  project: Doc<"projects">;
  hasCompanies: boolean;
  busy: boolean;
  error: string;
  onApproveAndSearch: () => void;
  onSearch: () => void;
  onViewProspects: () => void;
}) {
  const updateIcp = useMutation(api.projects.updateIcp);
  const [hl, setHl] = useState<Field | null>(null);
  const icp = project.icp ? icpSchema.parse(project.icp) : undefined;
  const insights = project.insights as Insights | undefined;
  const approved = project.icpApproved;

  if (!icp) return <EmptyState title="Strategy is locked" text="Markit needs your business profile before it can decide who to target." />;

  async function save(next: Icp) {
    const parsed = icpSchema.safeParse(next);
    if (!parsed.success) { toast(parsed.error.issues[0]?.message ?? "That change would make the ICP invalid."); return; }
    await updateIcp({ id: project._id, icp: parsed.data });
    if (approved) toast("ICP edited. Approve it again to search with the changes.");
  }

  const chips = (values: string[], onChange: (v: string[]) => void, opts: { cls?: string; titles?: string[]; min?: number } = {}) => (
    <div className="chips">
      {values.map((v, j) => (
        <span key={`${v}-${j}`} className={`chip ${opts.cls ?? ""}`} title={opts.titles?.[j]}>
          {v}
          {values.length > (opts.min ?? 0) && <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((_, k) => k !== j))}>×</button>}
        </span>
      ))}
      <input className="add" placeholder="+ Add" aria-label="Add"
        onKeyDown={(e) => {
          const v = e.currentTarget.value.trim();
          if (e.key !== "Enter" || !v) return;
          e.preventDefault(); e.currentTarget.value = "";
          if (!values.includes(v)) onChange([...values, v]);
        }} />
    </div>
  );
  const row = (field: Field, label: string, children: React.ReactNode, aside?: string) => (
    <div className={`icpf ${hl === field ? "hl" : ""}`} data-field={field}>
      <div className="hd"><span className="label">{label}</span>{aside && <span className="muted small">{aside}</span>}</div>
      {children}
    </div>
  );

  const reasons: [Field, string, React.ReactNode][] = [
    ...icp.segments.map((s, i): [Field, string, React.ReactNode] => [
      "segments", `Segment ${i + 1}: ${s.name}`,
      <><span>{s.rationale}</span>{s.searchQuery && <span className="quote mt-2 block">{s.searchQuery}</span>}</>,
    ]),
    ["roles", "Decision-makers", <span key="r">{icp.buyerRoles.map((r) => `${r.title}: ${r.why}`).join(" ")}</span>],
    ["rubric", "Scoring", <span key="s">Fit is scored out of 100 with a fixed rubric. Signal points are only given when the evidence is found in the Crustdata record.</span>],
    ["excl", "Overall reasoning", <span key="o">{icp.reasoning}</span>],
  ];

  return (
    <>
      <StepHeader step={2} title="Who Markit will target" lede="Check and edit the ideal customer profile. Nothing is searched until you approve it." />
      <ErrorNote message={error} />
      <div className="cols reveal">
        <section className="panel" aria-label="Ideal customer profile">
          <div className="icpf !flex-row flex-wrap items-center justify-between">
            <div className="estimate">Searches: <b>{icp.segments.length}</b> segments in <b>{icp.countries.length}</b> {icp.countries.length === 1 ? "country" : "countries"}</div>
            <StatusChip status={approved ? "Approved" : "Draft"} />
          </div>
          {row("segments", "Customer segments", chips(icp.segments.map((s) => s.name),
            (names) => save({ ...icp, segments: icp.segments.filter((s) => names.includes(s.name)) }), { min: 1, titles: icp.segments.map((s) => s.industries.join(", ")) }),
            "Each runs its own search")}
          {row("size", "Company size (employees)", (
            <div className="range2">
              <SizeInput label="Minimum employees" value={icp.minEmployees} onSave={(v) => save({ ...icp, minEmployees: v })} />
              <span>to</span>
              <SizeInput label="Maximum employees" value={icp.maxEmployees} onSave={(v) => save({ ...icp, maxEmployees: v })} />
            </div>
          ), icp.minEmployees == null && icp.maxEmployees == null ? "Not set: any size" : undefined)}
          {row("geo", "Geography", chips(icp.countries, (countries) => save({ ...icp, countries }), { min: 1 }))}
          {row("signals", "Buying signals", chips(icp.buyingSignals, (buyingSignals) => save({ ...icp, buyingSignals }), { cls: "wrap" }))}
          {row("roles", "Decision-maker roles", chips(icp.buyerRoles.map((r) => r.title),
            (titles) => save({ ...icp, buyerRoles: titles.map((t) => icp.buyerRoles.find((r) => r.title === t) ?? { title: t, why: "Added by you." }) }),
            { min: 1, titles: icp.buyerRoles.map((r) => r.why) }))}
          {row("excl", "Exclusions", chips(icp.exclusions, (exclusions) => save({ ...icp, exclusions }), { cls: "excl wrap" }), "Used when scoring")}
          {row("rubric", "Scoring rubric", (
            <div className="weights">
              {RUBRIC.map(([label, , w]) => (
                <div key={label} className="wrow"><span>{label}</span><div className="h-2 overflow-hidden rounded bg-[var(--grey-wash)]"><span className="block h-full rounded bg-[var(--text)]" style={{ width: `${(w / 40) * 100}%` }} /></div><b>{w}</b></div>
              ))}
            </div>
          ), "Fixed, total 100")}
        </section>

        <aside className="panel reason" aria-labelledby="h-reason">
          <div className="px-5 pb-1.5 pt-3.5">
            <h2 className="h2" id="h-reason">Why Markit chose this</h2>
            <p className="muted small mb-0 mt-1">Hover an item to see the field it explains.</p>
          </div>
          {reasons.map(([field, label, body], i) => (
            <button key={i} type="button" className="ritem" onMouseEnter={() => setHl(field)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(field)} onBlur={() => setHl(null)}
              onClick={() => document.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <span className="label">{label}</span>{body}
            </button>
          ))}
        </aside>
      </div>

      {insights && (
        <details className="panel snap">
          <summary><span className="h2">Market context</span><span className="src">AI context · not sourced</span></summary>
          <ul>{[...insights.trends, ...insights.demandDrivers, ...insights.opportunities].slice(0, 6).map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      )}

      <ActionBar msg={approved
        ? <span className="confirm">{Icons.check} Approved. Search will use these filters.</span>
        : <span className="muted">Approval gate 1 of 2. You can still edit afterwards.</span>}>
        {approved ? (
          hasCompanies ? (
            <>
              <button className="btn sec" type="button" disabled={busy} onClick={onSearch}>Search again</button>
              <button className="btn" type="button" onClick={onViewProspects}>Go to prospects</button>
            </>
          ) : <button className="btn" type="button" disabled={busy} onClick={onSearch}>Find companies</button>
        ) : <button className="btn" type="button" disabled={busy} onClick={onApproveAndSearch}>Approve ICP and find companies</button>}
      </ActionBar>
    </>
  );
}

function SizeInput({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  return (
    <input className="inp" type="number" min={1} aria-label={label} placeholder="Any" key={String(value)} defaultValue={value ?? ""}
      onBlur={(e) => {
        const raw = e.currentTarget.value.trim();
        const next = raw === "" ? null : Math.max(1, Math.round(Number(raw)));
        if (next !== value && (next === null || Number.isFinite(next))) onSave(next);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}
