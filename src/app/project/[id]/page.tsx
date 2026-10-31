"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Papa from "papaparse";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { icpSchema, type Icp, type Insights, type BusinessProfile } from "@/lib/schemas";
import type { ScoredQualification } from "@/lib/scoring";
import { postJson } from "@/lib/post-json";

const box = "border p-4 space-y-3";
const btn = "border px-3 py-1 disabled:opacity-50";

// Runs one pipeline step and tracks its busy/error state.
function useStep() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  }
  return { busy, error, run };
}

export default function ProjectPage() {
  const projectId = useParams<{ id: string }>().id as Id<"projects">;
  const project = useQuery(api.projects.get, { id: projectId });
  const companies = useQuery(api.companies.listByProject, { projectId });
  const contacts = useQuery(api.contacts.listByProject, { projectId });
  const drafts = useQuery(api.drafts.listByProject, { projectId });
  const step = useStep();

  if (project === undefined) return <main className="p-6">Loading…</main>;
  if (project === null) return <main className="p-6">Project not found. <Link href="/" className="underline">Back</Link></main>;

  const call = (name: string, url: string, extra: object = {}) =>
    step.run(name, () => postJson(url, { projectId, ...extra }));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <p><Link href="/" className="underline">← Projects</Link> · status: {project.status}</p>
      {step.error && <p className="border border-red-600 p-2 text-red-600">{step.error}</p>}
      {project.error && project.status === "error" && <p className="text-red-600">Last run failed: {project.error}</p>}

      <ProfileSection profile={project.profile as BusinessProfile} insights={project.insights as Insights} />
      <IcpSection project={project} />

      <section className={box}>
        <h2 className="text-lg font-semibold">3. Prospects</h2>
        <button className={btn} disabled={!project.icpApproved || !!step.busy} onClick={() => call("discover", "/api/discover")}>
          {step.busy === "discover" ? "Searching Crustdata and qualifying…" : "Discover & qualify companies"}
        </button>
        {!project.icpApproved && <p className="text-sm">Approve the ICP first.</p>}
        {companies && <ProspectTable companies={companies} />}
      </section>

      <section className={box}>
        <h2 className="text-lg font-semibold">4. Decision-makers</h2>
        <div className="flex gap-2">
          <button className={btn} disabled={!companies?.some((c) => c.selected) || !!step.busy}
            onClick={() => call("contacts", "/api/contacts")}>
            {step.busy === "contacts" ? "Finding people…" : "Find decision-makers at selected companies"}
          </button>
        </div>
        <p className="text-sm">Business emails are not available on the current Crustdata plan; contact via the LinkedIn profile.</p>
        {contacts && companies && <ContactTable contacts={contacts} companies={companies} />}
      </section>

      <section className={box}>
        <h2 className="text-lg font-semibold">5. Outreach</h2>
        <button className={btn} disabled={!contacts?.some((c) => c.selected) || !!step.busy}
          onClick={() => call("outreach", "/api/outreach")}>
          {step.busy === "outreach" ? "Writing drafts…" : "Generate drafts for selected contacts"}
        </button>
        {drafts && contacts && companies && (
          <Outreach drafts={drafts} contacts={contacts} companies={companies}
            regenerate={(contactId) => call(`regen-${contactId}`, "/api/outreach", { contactId })} busy={step.busy} />
        )}
      </section>
    </main>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <div><b>{title}:</b><ul className="list-disc pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>;
}

function ProfileSection({ profile, insights }: { profile: BusinessProfile; insights: Insights }) {
  return (
    <section className={box}>
      <h2 className="text-lg font-semibold">1. Business profile: {profile.companyName}</h2>
      <p>{profile.summary}</p>
      <p><b>Offering:</b> {profile.offering}</p>
      <p><b>Problem solved:</b> {profile.problemSolved}</p>
      <p><b>Value proposition:</b> {profile.valueProposition}</p>
      <p><b>Objective:</b> {profile.salesObjective}</p>
      <details>
        <summary className="cursor-pointer">Market insights (AI-generated context, not sourced research)</summary>
        <List title="Trends" items={insights?.trends} />
        <List title="Demand drivers" items={insights?.demandDrivers} />
        <List title="Opportunities" items={insights?.opportunities} />
      </details>
    </section>
  );
}

function IcpSection({ project }: { project: Doc<"projects"> }) {
  const updateIcp = useMutation(api.projects.updateIcp);
  const approveIcp = useMutation(api.projects.approveIcp);
  const icp = project.icp as Icp;
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save() {
    try {
      const parsed = icpSchema.parse(JSON.parse(text ?? ""));
      await updateIcp({ id: project._id, icp: parsed });
      setText(null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className={box}>
      <h2 className="text-lg font-semibold">2. Sales strategy / ICP {project.icpApproved ? "(approved)" : "(not approved)"}</h2>
      <p><b>Reasoning:</b> {icp.reasoning}</p>
      {icp.segments.map((s) => (
        <div key={s.name}>
          <b>Segment: {s.name}</b>: {s.industries.join(", ")}<br />
          {s.searchQuery && <span className="text-sm">Semantic search: &ldquo;{s.searchQuery}&rdquo;<br /></span>}
          <span className="text-sm">{s.rationale} Use cases: {s.useCases.join("; ")}</span>
        </div>
      ))}
      <p><b>Countries:</b> {icp.countries.join(", ")} · <b>Employees:</b> {icp.minEmployees ?? "any"}–{icp.maxEmployees ?? "any"}</p>
      <List title="Buyer roles" items={icp.buyerRoles.map((r) => `${r.title}: ${r.why}`)} />
      <List title="Buying signals" items={icp.buyingSignals} />
      <List title="Exclusions" items={icp.exclusions} />

      {text === null ? (
        <div className="flex gap-2">
          <button className="border px-3 py-1" onClick={() => setText(JSON.stringify(icp, null, 2))}>Edit ICP (JSON)</button>
          <button className="border px-3 py-1" disabled={project.icpApproved} onClick={() => approveIcp({ id: project._id })}>
            Approve ICP
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea className="h-80 w-full border p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <button className="border px-3 py-1" onClick={save}>Save (requires re-approval)</button>
            <button className="border px-3 py-1" onClick={() => setText(null)}>Cancel</button>
          </div>
          {error && <pre className="whitespace-pre-wrap text-xs text-red-600">{error}</pre>}
        </div>
      )}
    </section>
  );
}

function ProspectTable({ companies }: { companies: Doc<"companies">[] }) {
  const setSelected = useMutation(api.companies.setSelected);
  const [filter, setFilter] = useState("");
  const [minScore, setMinScore] = useState(0);
  if (!companies.length) return <p>No prospects yet.</p>;
  const visible = companies.filter((c) =>
    (c.score ?? 0) >= minScore && `${c.name} ${c.domain} ${c.segment}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input placeholder="Search" className="border p-1" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label>Min score <input type="number" className="w-16 border p-1" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /></label>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th></th><th>Score</th><th>Company</th><th>Segment</th><th>Why</th></tr></thead>
        <tbody>
          {visible.map((c) => {
            const q = c.qualification as ScoredQualification | undefined;
            return (
              <tr key={c._id} className="border-t align-top">
                <td><input type="checkbox" checked={c.selected} onChange={(e) => setSelected({ id: c._id, selected: e.target.checked })} /></td>
                <td>{c.score ?? "-"}</td>
                <td>{c.name}<br /><span className="text-gray-500">{c.domain}</span>{c.source === "fixture" && <b> [cached replay]</b>}</td>
                <td>{c.segment}</td>
                <td>
                  {q ? (
                    <details>
                      <summary className="cursor-pointer">{q.reasons[0]}</summary>
                      <p>Breakdown: fit {q.icpFit}/40 · use case {q.useCaseRelevance}/35 · signals {q.observedSignals}/25</p>
                      <List title="Reasons" items={q.reasons} />
                      <List title="Evidence" items={q.evidence.map((e) => `${e.claim} (${e.field} = ${e.value})`)} />
                      <List title="Missing" items={q.missingInformation} />
                    </details>
                  ) : "Not scored"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContactTable({ contacts, companies }: { contacts: Doc<"contacts">[]; companies: Doc<"companies">[] }) {
  const setSelected = useMutation(api.contacts.setSelected);
  if (!contacts.length) return <p>No contacts yet.</p>;
  const companyName = (id: Id<"companies">) => companies.find((c) => c._id === id)?.name ?? "";
  const withoutContacts = companies.filter((c) => c.selected && !contacts.some((x) => x.companyId === c._id));
  return (
    <>
    {withoutContacts.length > 0 && (
      <p className="text-sm">No relevant decision-makers found at: {withoutContacts.map((c) => c.name).join(", ")}</p>
    )}
    <table className="w-full text-sm">
      <thead><tr className="text-left"><th></th><th>Name</th><th>Title</th><th>Company</th><th>Email</th><th>Why</th></tr></thead>
      <tbody>
        {contacts.map((c) => (
          <tr key={c._id} className="border-t align-top">
            <td><input type="checkbox" checked={c.selected} onChange={(e) => setSelected({ id: c._id, selected: e.target.checked })} /></td>
            <td>{c.profileUrl ? <a className="underline" href={c.profileUrl} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</td>
            <td>{c.title}{c.source === "fixture" && <b> [cached replay]</b>}</td>
            <td>{companyName(c.companyId)}</td>
            <td>{c.email ?? "Not available"}</td>
            <td>{c.relevance}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}

function Outreach({ drafts, contacts, companies, regenerate, busy }: {
  drafts: Doc<"drafts">[]; contacts: Doc<"contacts">[]; companies: Doc<"companies">[];
  regenerate: (contactId: Id<"contacts">) => void; busy: string | null;
}) {
  const update = useMutation(api.drafts.update);
  const setStatusMany = useMutation(api.drafts.setStatusMany);
  if (!drafts.length) return <p>No drafts yet.</p>;

  const rows = drafts.map((d) => {
    const contact = contacts.find((c) => c._id === d.contactId);
    const company = companies.find((c) => c._id === contact?.companyId);
    return { d, contact, company };
  });
  const approved = rows.filter((r) => r.d.status === "approved" || r.d.status === "exported");

  async function exportCsv() {
    const csv = Papa.unparse(approved.map(({ d, contact, company }) => ({
      name: contact?.name, title: contact?.title, company: company?.name, domain: company?.domain,
      email: contact?.email ?? "", profile_url: contact?.profileUrl ?? "",
      subject: d.subject, body: d.body, cta: d.cta,
    })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "markit-outreach.csv" }).click();
    URL.revokeObjectURL(url);
    await setStatusMany({ ids: approved.map((r) => r.d._id), status: "exported" });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setStatusMany({ ids: drafts.map((d) => d._id), status: "approved" })}>Approve all</button>
        <button className={btn} disabled={!approved.length} onClick={exportCsv}>Export approved to CSV ({approved.length})</button>
      </div>
      <p className="text-sm">Statuses: draft → approved → exported. Nothing is sent from Markit yet.</p>
      {rows.map(({ d, contact, company }) => (
        <div key={d._id} className="space-y-2 border p-3">
          <p><b>{contact?.name}</b> ({contact?.title}, {company?.name}) · {contact?.email ?? "no email"} · <b>{d.status}</b></p>
          <input className="w-full border p-1" defaultValue={d.subject} key={`s-${d.subject}`}
            onBlur={(e) => e.target.value !== d.subject && update({ id: d._id, subject: e.target.value })} />
          <textarea className="h-48 w-full border p-1" defaultValue={d.body} key={`b-${d.body}`}
            onBlur={(e) => e.target.value !== d.body && update({ id: d._id, body: e.target.value })} />
          <p className="text-sm"><b>CTA:</b> {d.cta} · <b>Value prop:</b> {d.valueProposition}</p>
          <div className="flex gap-2">
            <button className={btn} disabled={d.status !== "draft"} onClick={() => update({ id: d._id, status: "approved" })}>Approve</button>
            <button className={btn} disabled={!!busy} onClick={() => regenerate(d.contactId)}>
              {busy === `regen-${d.contactId}` ? "Regenerating…" : "Regenerate"}
            </button>
            <button className={btn} onClick={() => navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`)}>Copy</button>
          </div>
        </div>
      ))}
    </div>
  );
}
