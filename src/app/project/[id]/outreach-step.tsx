"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Papa from "papaparse";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { ScoredQualification } from "@/lib/scoring";
import { ActionBar, EmptyState, ErrorNote, Icons, Progress, StatusChip, StepHeader, type StatusName } from "@/components/markit/app-shell";

const STATUS: Record<Doc<"drafts">["status"], StatusName> = { draft: "Draft", approved: "Approved", exported: "Exported", sent: "Sent" };
const DRAFT_LINES = ["Reading the evidence for each company", "Writing each email from your profile and the signals found", "Checking every cited field against the record", "Flagging placeholders and missing emails"];

export function OutreachStep({ companies, contacts, drafts, busy, error, onGoProspects, onWrite, onNext }: {
  companies: Doc<"companies">[];
  contacts: Doc<"contacts">[];
  drafts: Doc<"drafts">[];
  busy: string | null;
  error: string;
  onGoProspects: () => void;
  onWrite: (contactId?: Id<"contacts">) => void;
  onNext: () => void;
}) {
  const updateDraft = useMutation(api.drafts.update);
  const setStatusMany = useMutation(api.drafts.setStatusMany);
  const [currentId, setCurrentId] = useState<Id<"drafts"> | null>(null);
  const head = <StepHeader step={4} title="Review and approve each email" lede="Every email is written from your profile and the evidence Markit found. Nothing is sent until you launch the campaign." />;

  if (busy === "drafts") return <>{head}<Progress lines={DRAFT_LINES} /></>;
  const ready = contacts.filter((c) => c.selected).length;
  if (!drafts.length) {
    return (
      <>{head}<ErrorNote message={error} />
        {ready ? <EmptyState title="Ready to draft" text={`Markit will write one email for each of the ${ready} included decision-makers, using only your profile and the signals it found.`} action="Draft outreach" onAction={() => onWrite()} />
          : <EmptyState title="Outreach is locked" text="Choose companies on the Prospects step and find their decision-makers first." action="Go to prospects" onAction={onGoProspects} />}
      </>
    );
  }

  const contactOf = (d: Doc<"drafts">) => contacts.find((c) => c._id === d.contactId);
  const companyOf = (c?: Doc<"contacts">) => companies.find((co) => co._id === c?.companyId);
  const list = [...drafts].sort((a, b) => (companyOf(contactOf(b))?.score ?? 0) - (companyOf(contactOf(a))?.score ?? 0));
  const d = list.find((x) => x._id === currentId) ?? list[0];
  const contact = contactOf(d);
  const company = companyOf(contact);
  const qual = company?.qualification as ScoredQualification | undefined;
  const sent = d.status === "sent";
  const isApproved = d.status !== "draft";
  const nApproved = drafts.filter((x) => x.status !== "draft").length;
  const pending = drafts.filter((x) => x.status === "draft");

  const placeholders = [...new Set(`${d.subject}\n${d.body}`.match(/\[[^\]]+\]/g) ?? [])];
  const checks: { k: "ok" | "warn" | "bad"; text: string }[] = [];
  if (d.citations?.length) checks.push({ k: "ok", text: `${d.citations.length} ${d.citations.length === 1 ? "statement traces" : "statements trace"} to cited Crustdata fields.` });
  else checks.push({ k: "warn", text: "No statements were cited to the company record. Check the facts before approving." });
  if (placeholders.length) checks.push({ k: "warn", text: `Unfilled placeholder: ${placeholders.join(", ")}. Replace it before sending.` });
  if (!contact?.email) checks.push({ k: "warn", text: `No work email for ${contact?.name ?? "this person"}. The export lists their profile link instead.` });

  async function exportCsv() {
    const approved = drafts.filter((x) => x.status === "approved" || x.status === "exported");
    const rows = approved.map((x) => {
      const c = contactOf(x); const co = companyOf(c);
      return { name: c?.name, title: c?.title, company: co?.name, domain: co?.domain, email: c?.email ?? "", profile_url: c?.profileUrl ?? "", subject: x.subject, body: x.body, cta: x.cta };
    });
    const url = URL.createObjectURL(new Blob([Papa.unparse(rows)], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "markit-outreach.csv" }).click();
    URL.revokeObjectURL(url);
    await setStatusMany({ ids: approved.filter((x) => x.status === "approved").map((x) => x._id), status: "exported" });
    toast(`${approved.length} approved emails exported as CSV. Nothing was sent.`);
  }

  return (
    <>
      {head}
      <ErrorNote message={error} />
      <div className="three reveal">
        <nav className="panel olist" aria-label="Emails">
          <div className="bulk">
            <button className="btn sm sec" type="button" disabled={!pending.length}
              onClick={async () => {
                const blocked = pending.filter((x) => /\[[^\]]+\]/.test(x.body + x.subject));
                await setStatusMany({ ids: pending.map((x) => x._id), status: "approved" });
                toast(blocked.length ? `Approved ${pending.length}. ${blocked.length} still ${blocked.length === 1 ? "has" : "have"} a placeholder to fill.` : `Approved ${pending.length} emails`);
              }}>Approve all</button>
            <button className="btn sm ghost" type="button" disabled={!!busy || !ready} onClick={() => onWrite()}>Regenerate all</button>
          </div>
          {list.map((x) => {
            const c = contactOf(x);
            return (
              <button key={x._id} className="oi" type="button" aria-current={x._id === d._id} onClick={() => setCurrentId(x._id)}>
                <span className="r1"><span>{companyOf(c)?.name ?? "Company"}</span><StatusChip status={STATUS[x.status]} /></span>
                <span className="r2">{c?.name}, {c?.title}</span>
              </button>
            );
          })}
        </nav>

        <section className="panel editor" aria-label="Email editor">
          <div className="to">
            <span className="label">To</span><strong className="font-medium">{contact?.name}</strong><span className="muted">{contact?.title}, {company?.name}</span>
            {contact?.email ? <span className="mail ok">{Icons.mail} {contact.email}</span> : <span className="mail no">Email not available</span>}
          </div>
          <div>
            <label className="label" htmlFor="o-sub">Subject</label>
            <input className="subj w-full bg-transparent" id="o-sub" key={`${d._id}-${d.subject}`} defaultValue={d.subject} readOnly={sent}
              onBlur={(e) => !sent && e.target.value !== d.subject && updateDraft({ id: d._id, subject: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="o-body">Email</label>
            <textarea className="body w-full resize-y" id="o-body" rows={13} key={`${d._id}-${d.body}`} defaultValue={d.body} readOnly={sent}
              onBlur={(e) => !sent && e.target.value !== d.body && updateDraft({ id: d._id, body: e.target.value })} />
          </div>
          <div className="checks" aria-live="polite">
            {checks.map((c) => <div key={c.text} className={`chk ${c.k}`}>{c.k === "ok" ? Icons.check : "⚠"} <span>{c.text}</span></div>)}
            {sent && d.sentAt && <div className="chk ok">{Icons.check}<span>Sent {new Date(d.sentAt).toLocaleString()}. Locked from editing.</span></div>}
          </div>
          <div className="ctrl">
            <button className="btn sm sec" type="button" disabled={!!busy || sent} onClick={() => onWrite(d.contactId)}>{busy === `regen-${d.contactId}` ? "Rewriting…" : "Regenerate"}</button>
            <button className="btn sm ghost" type="button" onClick={async () => { await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`); toast("Email copied"); }}>Copy</button>
            <span className="flex-1" />
            <button className="btn" type="button" disabled={isApproved}
              onClick={async () => {
                await updateDraft({ id: d._id, status: "approved" });
                toast(`Email to ${contact?.name ?? "contact"} approved`);
                const next = list.find((x) => x._id !== d._id && x.status === "draft");
                if (next) setCurrentId(next._id);
              }}>{isApproved ? STATUS[d.status] : "Approve"}</button>
          </div>
        </section>

        <aside className="panel why" aria-labelledby="h-why">
          <h2 className="h2" id="h-why">Why this company</h2>
          <div className="grp">
            <span className="label">Approached because</span>
            {qual?.evidence.length ? qual.evidence.map((e) => (
              <div key={e.field + e.claim} className="ev"><span>{e.claim}</span><span className="src" title={e.value}>Crustdata · {e.field}</span></div>
            )) : <span className="muted small">{qual?.reasons[0] ?? "No verified signal."}</span>}
          </div>
          <div className="grp">
            <span className="label">Role chosen</span>
            <div className="ev"><span><strong className="font-medium">{contact?.title}.</strong> {contact?.relevance}</span>
              {contact?.profileUrl && <a className="src" href={contact.profileUrl} target="_blank" rel="noreferrer">Profile ↗</a>}
              {contact?.source === "manual" && <span className="muted small">Added by you, not Crustdata data</span>}
            </div>
          </div>
          <div className="grp">
            <span className="label">Statements cited in this email</span>
            {d.citations?.length ? d.citations.map((c) => (
              <div key={c.field + c.statement} className="ev"><span>{c.statement}</span><span className="src" title={c.value}>{c.field}</span></div>
            )) : <span className="muted small">None</span>}
          </div>
          <div className="grp"><span className="label">Call to action</span><span className="small">{d.cta}</span></div>
        </aside>
      </div>
      <ActionBar msg={<><strong className="font-medium">{nApproved} of {drafts.length}</strong> approved. Approval gate 2 of 2.</>}>
        <button className="btn sec" type="button" disabled={!nApproved} onClick={exportCsv}>Export CSV</button>
        <button className={`btn ${nApproved === drafts.length ? "" : "sec"}`} type="button" disabled={!nApproved} onClick={onNext}>Continue to campaign</button>
      </ActionBar>
    </>
  );
}
