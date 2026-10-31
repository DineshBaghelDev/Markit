"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { parseStoredIcp } from "@/lib/schemas";
import type { ScoredQualification } from "@/lib/scoring";
import { ActionBar, Banner, EmptyState, ErrorNote, Icons, Progress, ScorePill, StepHeader } from "@/components/markit/app-shell";
import { RUBRIC } from "./strategy-step";

type Company = Doc<"companies">;
type Contact = Doc<"contacts">;

const DISCOVER_LINES = ["Turning the ICP into Crustdata searches", "Searching companies per segment", "Removing duplicates", "Companies appear here as soon as the search returns", "You can leave this page; Markit keeps working"];
const PEOPLE_LINES = ["Finding people at the selected companies", "Filtering to decision-maker seniority", "Matching titles to your buyer roles"];

// Typed accessors for the raw Crustdata record stored on each company.
function facts(c: Company) {
  const data = (c.data ?? {}) as { locations?: { city?: string; country?: string }; headcount?: { total?: number }; basic_info?: { employee_count_range?: string } };
  return { city: data.locations?.city || data.locations?.country || "–", head: data.headcount?.total, range: data.basic_info?.employee_count_range };
}
const qualOf = (c: Company) => c.qualification as ScoredQualification | undefined;

export function ProspectsStep({ project, companies, contacts, busy, error, onGoStrategy, onDiscover, onFindPeople, onDraft, onEnrich }: {
  project: Doc<"projects">;
  companies: Company[] | undefined;
  contacts: Contact[];
  busy: string | null;
  error: string;
  onGoStrategy: () => void;
  onDiscover: () => void;
  onFindPeople: () => void;
  onDraft: () => void;
  onEnrich: () => void;
}) {
  const setSelected = useMutation(api.companies.setSelected);
  const [f, setF] = useState({ q: "", min: 0, head: "all", seg: "all", loc: "all" });
  const [sort, setSort] = useState<{ k: "score" | "name" | "head"; d: 1 | -1 }>({ k: "score", d: -1 });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [openId, setOpenId] = useState<Id<"companies"> | null>(null);
  const closeDrawer = useCallback(() => setOpenId(null), []);

  const list = companies ?? [];
  const head = <StepHeader step={3} title="Worth approaching, and why" lede="Ranked by fit with your approved ICP. Click any company to see the evidence behind its score." />;

  // While a search runs, show progress until companies arrive; after that the table fills in as scores land.
  const scoring = busy === "discover" && (companies?.length ?? 0) > 0;
  if (busy === "discover" && !scoring) return <>{head}<Progress lines={DISCOVER_LINES} /></>;
  if (companies === undefined) return <>{head}<EmptyState title="Loading prospects" text="One moment." expr="thinking" /></>;
  if (!list.length && !project.icpApproved) return <>{head}<EmptyState title="Prospects are locked" text="Approve your ICP first. Markit searches only with filters you have approved." action="Go to strategy" onAction={onGoStrategy} /></>;
  if (!list.length) return <>{head}<ErrorNote message={error} /><EmptyState title="Ready to search" text="Your ICP is approved. Markit will search Crustdata for companies that match it." action="Find companies" onAction={onDiscover} /></>;

  const icp = parseStoredIcp(project.icp);
  const q = f.q.toLowerCase();
  const rows = list.filter((c) => !hidden.has(c._id)).filter((c) => {
    const { city, head: n } = facts(c);
    const sizeOk = f.head === "all" || (n != null && (f.head === "s" ? n <= 150 : f.head === "m" ? n > 150 && n <= 500 : n > 500));
    return (c.score ?? 0) >= f.min && sizeOk && (f.seg === "all" || c.segment === f.seg) && (f.loc === "all" || city === f.loc) &&
      (!q || `${c.name} ${city} ${c.segment} ${qualOf(c)?.evidence.map((e) => e.claim).join(" ") ?? ""}`.toLowerCase().includes(q));
  }).sort((a, b) => {
    const v = sort.k === "name" ? a.name.localeCompare(b.name) : sort.k === "head" ? (facts(a).head ?? 0) - (facts(b).head ?? 0) : (a.score ?? 0) - (b.score ?? 0);
    return v * sort.d;
  });
  const segments = [...new Set(list.map((c) => c.segment))];
  const cities = [...new Set(list.map((c) => facts(c).city))].sort();
  const selected = list.filter((c) => c.selected);
  const withSignal = list.filter((c) => qualOf(c)?.evidence.length).length;
  const topCities = cities.map((c) => [c, list.filter((x) => facts(x).city === c).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 2);
  // Guided example projects copy a recorded run, so they must not claim to be live.
  const replayed = !!project.demoOf || list.some((c) => c.source === "fixture");
  const open = list.find((c) => c._id === openId) ?? null;
  const people = contacts.filter((p) => selected.some((c) => c._id === p.companyId));
  const draftable = selected.filter((c) => contacts.some((p) => p.companyId === c._id && p.selected));

  const sortBtn = (k: typeof sort.k, label: string) => (
    <button type="button" aria-label={`Sort by ${label}`} onClick={() => setSort({ k, d: sort.k === k ? (sort.d === 1 ? -1 : 1) : k === "name" ? 1 : -1 })}>
      {label}{sort.k === k ? (sort.d < 0 ? " ↓" : " ↑") : ""}
    </button>
  );

  return (
    <>
      {head}
      <ErrorNote message={error} />
      <div className="reveal flex flex-col gap-4">
        {busy === "contacts" && <Progress lines={PEOPLE_LINES} />}
        {scoring && (
          <Banner kind="warn"><strong className="font-semibold">Scoring {list.length} companies.</strong> {list.filter((c) => c.score !== undefined).length} scored so far. Scores appear batch by batch; you can review or leave this page meanwhile.</Banner>
        )}
        <Banner kind="ok" action={
          <details className="how"><summary>How we searched</summary><div className="code">{[
            "Crustdata Company Search",
            ...icp.segments.map((s) => `  ${s.name}\n    ${s.searchQuery ? `semantic   "${s.searchQuery}"` : `industry   ${s.industries.join(", ")}`}`),
            `  location     ${icp.countries.join(", ")}`,
            `  headcount    ${icp.minEmployees ?? "any"} to ${icp.maxEmployees ?? "any"}`,
            "LLM qualification   fixed rubric, evidence must exist in the record",
          ].join("\n")}</div></details>
        }>
          <strong className="font-semibold">Found {list.length} companies.</strong> {replayed ? "Replayed from a recorded Crustdata run." : "Fetched live from Crustdata."}
        </Banner>
        {project.status === "prospects_ready" && project.error && <Banner kind="warn"><strong className="font-semibold">Search notes.</strong> {project.error}</Banner>}

        <details className="panel snap" open>
          <summary><span className="h2">Market snapshot</span><span className="muted small">From this search</span></summary>
          <ul>
            <li>{withSignal} of {list.length} companies have at least one verified fact in their Crustdata record.</li>
            <li>{list.filter((c) => (c.score ?? 0) >= 80).length} score 80 or more; {list.filter((c) => (c.score ?? 0) >= 60).length} score 60 or more.</li>
            {topCities.length > 0 && <li>{topCities.map(([c, n]) => `${c} (${n})`).join(" and ")} hold the most matches.</li>}
          </ul>
        </details>

        <div className="filters" role="group" aria-label="Filter companies">
          <label className="sr" htmlFor="f-q">Search</label>
          <input className="inp q" id="f-q" placeholder="Search companies, signals, places" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <label className="sr" htmlFor="f-min">Score</label>
          <select className="inp" id="f-min" value={f.min} onChange={(e) => setF({ ...f, min: +e.target.value })}>
            <option value={0}>Any score</option><option value={60}>Score 60+</option><option value={80}>Score 80+</option>
          </select>
          <label className="sr" htmlFor="f-head">Headcount</label>
          <select className="inp" id="f-head" value={f.head} onChange={(e) => setF({ ...f, head: e.target.value })}>
            <option value="all">Any headcount</option><option value="s">Up to 150</option><option value="m">151 to 500</option><option value="l">501 and up</option>
          </select>
          <label className="sr" htmlFor="f-seg">Segment</label>
          <select className="inp max-w-[240px]" id="f-seg" value={f.seg} onChange={(e) => setF({ ...f, seg: e.target.value })}>
            <option value="all">Any segment</option>{segments.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="sr" htmlFor="f-loc">Location</label>
          <select className="inp" id="f-loc" value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })}>
            <option value="all">Any location</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {hidden.size > 0 && <label className="toggle"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show excluded ({hidden.size})</label>}
          <button className="btn sm ghost" type="button" onClick={() => {
            const top = new Set(rows.slice(0, 5).map((c) => c._id));
            list.forEach((c) => { if (c.selected !== top.has(c._id)) setSelected({ id: c._id, selected: top.has(c._id) }); });
            toast(`Selected the top ${top.size}`);
          }}>Select top 5</button>
        </div>

        <div className="panel tablebox">
          <table>
            <caption className="sr">Ranked companies</caption>
            <thead><tr><th><span className="sr">Select</span></th><th>{sortBtn("name", "Company")}</th><th>Location</th><th>{sortBtn("head", "Headcount")}</th><th>{sortBtn("score", "Score")}</th><th>Top signal</th><th>Missing info</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((c) => {
                const qual = qualOf(c); const { city, head: n, range } = facts(c);
                const missing = qual?.missingInformation ?? [];
                return (
                  <tr key={c._id} data-id={c._id} className={`${c.selected ? "sel" : ""} ${openId === c._id ? "open" : ""}`} onClick={() => setOpenId(c._id)}>
                    <td><input className="cbx" type="checkbox" aria-label={`Select ${c.name}`} checked={c.selected} onClick={(e) => e.stopPropagation()} onChange={(e) => setSelected({ id: c._id, selected: e.target.checked })} /></td>
                    <td><div className="co">{c.name}</div><div className="muted small clamp2">{c.segment}</div></td>
                    <td>{city}</td>
                    <td className="font-mono">{n ? `~${n.toLocaleString("en")}` : range ?? "–"}</td>
                    <td><ScorePill score={c.score} /></td>
                    <td className="max-w-[280px]"><span className="clamp2">{qual?.evidence[0]?.claim ?? <span className="muted">No verified signal</span>}</span></td>
                    <td className={missing.length ? "miss" : "muted"}><span className="clamp2">{missing.length ? `${missing[0]}${missing.length > 1 ? ` +${missing.length - 1}` : ""}` : "None"}</span></td>
                  </tr>
                );
              }) : <tr><td colSpan={7} className="muted !p-9 text-center">No companies match these filters. Try lowering the score filter or clearing the search.</td></tr>}
              {showHidden && list.filter((c) => hidden.has(c._id)).map((c) => (
                <tr key={c._id} className="ex"><td><input className="cbx" type="checkbox" disabled aria-label={`${c.name} is excluded`} /></td><td><div className="co">{c.name}</div></td><td>{facts(c).city}</td><td /><td colSpan={3}>Excluded by you. <button className="link small" type="button" onClick={() => { const n = new Set(hidden); n.delete(c._id); setHidden(n); }}>Restore</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {busy !== "contacts" && contacts.length > 0 && (
          <People companies={selected} contacts={people} busy={busy} onEnrich={onEnrich} />
        )}
      </div>

      {(selected.length > 0 || contacts.length > 0) && busy !== "contacts" && (
        contacts.length > 0 ? (
          <ActionBar msg={<><strong className="font-medium">{draftable.length}</strong> of {selected.length} companies have a decision-maker included</>}>
            <button className="btn sec" type="button" disabled={!!busy || !selected.length} onClick={onFindPeople}>Find people again</button>
            <button className="btn" type="button" disabled={!draftable.length || !!busy} onClick={onDraft}>
              {busy === "drafts" ? "Drafting…" : `Draft outreach for ${draftable.length} ${draftable.length === 1 ? "company" : "companies"}`}
            </button>
          </ActionBar>
        ) : (
          <ActionBar msg={<strong className="font-medium">{selected.length} selected</strong>}>
            <button className="btn" type="button" disabled={!!busy} onClick={onFindPeople}>Find decision-makers</button>
          </ActionBar>
        )
      )}

      <Drawer company={open} onClose={closeDrawer}
        onToggle={(c) => { setSelected({ id: c._id, selected: !c.selected }); toast(c.selected ? `${c.name} removed from outreach` : `${c.name} selected for outreach`); closeDrawer(); }}
        onExclude={(c) => { setHidden(new Set(hidden).add(c._id)); if (c.selected) setSelected({ id: c._id, selected: false }); closeDrawer(); toast(`${c.name} excluded. Turn on “Show excluded” to see it.`); }} />
    </>
  );
}

function People({ companies, contacts, busy, onEnrich }: { companies: Company[]; contacts: Contact[]; busy: string | null; onEnrich: () => void }) {
  const setContactSelected = useMutation(api.contacts.setSelected);
  const addTestContact = useMutation(api.contacts.addTestContact);
  const [adding, setAdding] = useState<Id<"companies"> | null>(null);
  const toEnrich = contacts.filter((c) => c.selected && c.emailStatus === "not_enriched").length;

  return (
    <section className="dm" aria-labelledby="h-dm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="h2 !text-xl !font-normal" id="h-dm">Decision-makers</h2>
        <span className="flex flex-wrap items-center gap-3">
          <span className="muted small">Work emails are only shown when Crustdata returns them</span>
          <button className="btn sm sec" type="button" disabled={!toEnrich || !!busy} onClick={onEnrich}>{busy === "enrich" ? "Looking up…" : `Find work emails (${toEnrich})`}</button>
        </span>
      </div>
      {[...companies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((c) => {
        const ps = contacts.filter((p) => p.companyId === c._id);
        return (
          <div key={c._id} className="panel dmco">
            <div className="hd"><span><strong className="font-medium">{c.name}</strong> <span className="muted small">{facts(c).city}</span></span><ScorePill score={c.score} /></div>
            {ps.length ? (
              <div className="people">
                {ps.map((p) => (
                  <div key={p._id} className={`person ${p.selected ? "" : "skipped"}`}>
                    <div className="top">
                      <span><span className="nm">{p.name}</span><br /><span className="muted">{p.title}, {c.name}</span></span>
                      <span className={`rel ${p.selected ? "High" : "Medium"}`}>{p.selected ? "Included" : "Skipped"}</span>
                    </div>
                    <div>{p.relevance}</div>
                    {p.email ? <span className="mail ok">{Icons.mail} {p.email}</span>
                      : <span className="mail no">{p.emailStatus === "unavailable" ? "Email not available" : "Email not looked up"}</span>}
                    <div className="flex items-center justify-between gap-2">
                      {p.source === "manual" ? <span className="muted small">Added by you</span>
                        : p.profileUrl ? <a className="src" href={p.profileUrl} target="_blank" rel="noreferrer">Profile ↗</a> : <span className="src">Crustdata</span>}
                      <button className="btn sm ghost" type="button" onClick={() => setContactSelected({ id: p._id, selected: !p.selected })}>{p.selected ? "Skip" : "Include"}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="nodm">No decision-maker found. This company can’t be drafted unless you add someone.</div>}
            <div>
              {adding === c._id ? (
                <form className="fgrid items-end" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const name = String(fd.get("name") ?? "").trim(), email = String(fd.get("email") ?? "").trim();
                    if (!name) { toast("Add a name first"); return; }
                    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Add a valid email address"); return; }
                    await addTestContact({ projectId: c.projectId, companyId: c._id, name, title: String(fd.get("title") ?? "").trim() || "Title not given", email });
                    setAdding(null); toast(`${name} added`);
                  }}>
                  <div className="field"><label className="label" htmlFor={`mn-${c._id}`}>Name</label><input className="inp" id={`mn-${c._id}`} name="name" autoFocus /></div>
                  <div className="field"><label className="label" htmlFor={`mt-${c._id}`}>Title</label><input className="inp" id={`mt-${c._id}`} name="title" /></div>
                  <div className="field"><label className="label" htmlFor={`me-${c._id}`}>Email</label><input className="inp" id={`me-${c._id}`} name="email" type="email" /></div>
                  <span className="flex gap-2"><button className="btn sm" type="submit">Add person</button><button className="btn sm ghost" type="button" onClick={() => setAdding(null)}>Cancel</button></span>
                </form>
              ) : <button className="link small" type="button" onClick={() => setAdding(c._id)}>Add person manually</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Drawer({ company, onClose, onToggle, onExclude }: { company: Company | null; onClose: () => void; onToggle: (c: Company) => void; onExclude: (c: Company) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [filled, setFilled] = useState(false);
  const [shown, setShown] = useState(company);
  if (company && company !== shown) setShown(company);
  const isOpen = !!company;

  useEffect(() => {
    if (!isOpen) return;
    const last = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(id); removeEventListener("keydown", onKey); setFilled(false); last?.focus?.(); };
  }, [isOpen, onClose]);

  const qual = shown ? qualOf(shown) : undefined;
  const fx = shown ? facts(shown) : null;
  return (
    <aside className={`drawer ${isOpen ? "open" : ""}`} aria-labelledby="d-title" aria-hidden={!isOpen} inert={!isOpen}>
      {shown && fx && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="muted small">{[fx.city, fx.head ? `~${fx.head.toLocaleString("en")} employees` : fx.range, shown.segment].filter(Boolean).join(", ")}</span>
              <h2 id="d-title">{shown.name}</h2>
              {shown.domain && <a className="src self-start" href={`https://${shown.domain}`} target="_blank" rel="noreferrer">{shown.domain} ↗</a>}
            </div>
            <button ref={closeRef} className="x" type="button" aria-label="Close evidence" onClick={onClose}>×</button>
          </div>
          <div className="flex items-center gap-3"><ScorePill score={shown.score} /><span className="muted small">Fit score out of 100. An explainable fit, not a chance of buying.</span></div>
          {qual && (
            <>
              <div className="bd" aria-label="Score breakdown">
                <span className="label">Score breakdown</span>
                {RUBRIC.map(([label, key, max]) => (
                  <div key={key} className="bd-row"><span>{label}</span><b>{qual[key]} of {max}</b><div className="track"><span style={{ width: filled ? `${(qual[key] / max) * 100}%` : 0 }} /></div></div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5"><span className="label">Why relevant</span>{qual.reasons.map((r) => <p key={r} className="m-0 text-sm leading-relaxed">{r}</p>)}</div>
              <div className="sigs">
                <span className="label">Signals</span>
                {qual.evidence.length ? qual.evidence.map((e) => (
                  <div key={e.field + e.claim} className="sigrow"><span className="ico">{Icons.check}</span><span className="t"><span>{e.claim}</span><span className="src" title={e.value}>Crustdata · {e.field}</span></span></div>
                )) : <span className="muted small">No evidence confirmed in the record, so no signal points were given.</span>}
                {qual.rejectedEvidence > 0 && <div className="chk bad"><strong>{qual.rejectedEvidence} {qual.rejectedEvidence === 1 ? "claim" : "claims"} removed by the checker:</strong> the cited field was missing or did not match.</div>}
              </div>
              <div className="flex flex-col gap-2">
                <span className="label">Missing information</span>
                {qual.missingInformation.length ? <ul className="misslist">{qual.missingInformation.map((m) => <li key={m}>{m}: not found, not guessed</li>)}</ul> : <span className="muted small">Nothing missing.</span>}
              </div>
            </>
          )}
          <div className="mt-auto flex flex-wrap gap-2.5">
            <button className="btn" type="button" onClick={() => onToggle(shown)}>{shown.selected ? "Remove from outreach" : "Select for outreach"}</button>
            <button className="btn sec" type="button" onClick={() => onExclude(shown)}>Exclude</button>
          </div>
        </>
      )}
    </aside>
  );
}
