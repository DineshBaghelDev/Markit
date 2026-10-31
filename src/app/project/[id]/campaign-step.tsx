"use client";

import { useEffect, useState } from "react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { ActionBar, Banner, EmptyState, Icons, Progress, StatusChip, StepHeader } from "@/components/markit/app-shell";

type SendConfig = { configured: boolean; from: string | null; allowlistSize: number; dailyLimit: number; optOutLine: string };

export function CampaignStep({ companies, contacts, drafts, busy, onGoOutreach, onSend }: {
  companies: Doc<"companies">[];
  contacts: Doc<"contacts">[];
  drafts: Doc<"drafts">[];
  busy: string | null;
  onGoOutreach: () => void;
  onSend: (ids: Id<"drafts">[]) => void;
}) {
  const [config, setConfig] = useState<SendConfig | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState<"setup" | "pipeline">("setup");
  useEffect(() => { fetch("/api/send/config").then((r) => r.json()).then(setConfig).catch(() => setConfig(null)); }, []);

  const contactOf = (d: Doc<"drafts">) => contacts.find((c) => c._id === d.contactId);
  const companyOf = (c?: Doc<"contacts">) => companies.find((co) => co._id === c?.companyId);
  const approved = drafts.filter((d) => d.status === "approved" || d.status === "exported");
  const sent = drafts.filter((d) => d.status === "sent");
  const sendable = approved.filter((d) => contactOf(d)?.email);
  const blocked = approved.filter((d) => !contactOf(d)?.email);
  const withPlaceholder = sendable.filter((d) => /\[[^\]]+\]/.test(d.subject + d.body));
  const view = sent.length && tab === "setup" && !sendable.length ? "pipeline" : tab;

  if (busy === "send") return <><StepHeader step={5} title="Sending your emails" /><Progress lines={["Checking each recipient against the allowlist", "Adding the opt-out line", "Sending one at a time from your Gmail"]} /></>;
  if (!approved.length && !sent.length) {
    return <><StepHeader step={5} title="Nothing to send yet" /><EmptyState title="Nothing to send yet" text="Approve at least one email on the Outreach step. Only approved emails can go into a campaign." action="Go to outreach" onAction={onGoOutreach} /></>;
  }

  const ready = config?.configured && sendable.length > 0;
  return (
    <>
      <StepHeader step={5} title={sent.length ? `${sent.length} ${sent.length === 1 ? "email" : "emails"} sent` : `Send ${sendable.length} ${sendable.length === 1 ? "email" : "emails"}`}
        lede="Markit sends from your Gmail, one at a time, only to allowlisted addresses, with an opt-out line on every email." />
      <Banner kind="warn"><strong className="font-semibold">Safety lock.</strong> Mail is delivered only to addresses on the server’s EMAIL_ALLOWLIST{config ? ` (${config.allowlistSize} ${config.allowlistSize === 1 ? "address" : "addresses"})` : ""}. Real prospects are never emailed by accident.</Banner>

      {sent.length > 0 && (
        <div className="ctabs" role="tablist" aria-label="Campaign views">
          {([["setup", `Send${sendable.length ? ` (${sendable.length})` : ""}`], ["pipeline", `Pipeline (${sent.length + approved.length})`]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" className="ctab" aria-selected={view === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      )}

      {view === "pipeline" ? (
        <>
          <div className="panel flex flex-col gap-4 px-5 py-[18px]">
            <div className="tiles">
              {([["Sent", sent.length], ["Approved, not sent", approved.length], ["Can’t send (no email)", blocked.length]] as const).map(([l, v]) => (
                <div key={l} className="tile"><span className="n">{v}</span><span className="d">{l}</span></div>
              ))}
            </div>
            <p className="muted small m-0">Replies arrive in your Gmail inbox. Reply tracking and automatic follow-ups are not connected yet.</p>
          </div>
          <div className="panel tablebox">
            <table className="!min-w-[720px]">
              <caption className="sr">Pipeline</caption>
              <thead><tr><th>Company</th><th>Contact</th><th>Status</th><th>Last activity</th><th>Next step</th></tr></thead>
              <tbody>
                {[...sent, ...approved].map((d) => {
                  const c = contactOf(d);
                  return (
                    <tr key={d._id} className="cursor-default">
                      <td className="co">{companyOf(c)?.name}</td>
                      <td>{c?.name}<br /><span className="muted small">{c?.title}</span></td>
                      <td><StatusChip status={d.status === "sent" ? "Sent" : d.status === "exported" ? "Exported" : "Approved"} /></td>
                      <td className="small">{d.sentAt ? `Sent ${new Date(d.sentAt).toLocaleString()}` : "Approved"}</td>
                      <td className="small muted">{d.status === "sent" ? "Watch your inbox for a reply" : c?.email ? "Ready to send" : "No email: use the profile link"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="cols reveal">
          <div className="flex flex-col gap-4">
            <section className="panel flex flex-col gap-3.5 p-5" aria-labelledby="h-from">
              <h2 className="h2" id="h-from">1. Send from</h2>
              {config === null ? <span className="muted small">Checking email setup…</span> : config.configured
                ? <div className="chk ok">{Icons.check}<span>Gmail connected. Emails go out from {config.from}, one at a time.</span></div>
                : <div className="chk warn">⚠ <span>Gmail is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD to the server environment, then reload.</span></div>}
            </section>
            <section className="panel flex flex-col gap-3 p-5" aria-labelledby="h-first">
              <h2 className="h2" id="h-first">2. First email</h2>
              <div className="ev bg-[var(--bg)]"><span><strong className="font-medium">Day 0.</strong> Your approved email. No booking link: it asks for a reply, not a meeting.</span></div>
              <p className="muted small m-0">Automatic follow-ups are not available yet. Follow up from your inbox if there’s no reply.</p>
            </section>
            <section className="panel flex flex-col gap-3 p-5" aria-labelledby="h-guard">
              <h2 className="h2" id="h-guard">3. Guardrails</h2>
              <div className="kv" style={{ gridTemplateColumns: "170px minmax(0,1fr)" }}>
                <span className="label">Daily limit</span><span>{config?.dailyLimit ?? 20} emails per day</span>
                <span className="label">Allowlist</span><span>{Icons.check} Always on. Other recipients are skipped and reported.</span>
                <span className="label">Duplicate check</span><span>{Icons.check} Always on. Sent emails are locked and never sent twice.</span>
                <span className="label">Opt-out line</span><span>{Icons.check} Always on. “{config?.optOutLine ?? "Reply “unsubscribe” and we will not contact you again."}”</span>
              </div>
            </section>
          </div>
          <aside className="panel why" aria-labelledby="h-rec">
            <h2 className="h2" id="h-rec">Recipients</h2>
            {sendable.length ? sendable.map((d) => {
              const c = contactOf(d);
              return <div key={d._id} className="ev bg-[var(--bg)]"><span><strong className="font-medium">{c?.name}</strong>, {c?.title}</span><span className="muted small">{companyOf(c)?.name} · {c?.email}</span></div>;
            }) : <span className="muted small">No approved email has a recipient address yet.</span>}
            {blocked.length > 0 && <div className="chk warn">⚠ <span>{blocked.map((d) => contactOf(d)?.name).join(", ")} {blocked.length === 1 ? "has" : "have"} no work email, so {blocked.length === 1 ? "is" : "are"} left out. Markit never guesses an address.</span></div>}
            {withPlaceholder.length > 0 && <div className="chk warn">⚠ <span>{withPlaceholder.length} {withPlaceholder.length === 1 ? "email still has" : "emails still have"} a [placeholder]. Fill it on the Outreach step before sending.</span></div>}
          </aside>
        </div>
      )}

      {view === "setup" && (
        <ActionBar msg={`${sendable.length} ready${config && !config.configured ? ". Set up Gmail to continue" : ""}`}>
          <button className="btn" type="button" disabled={!ready || !!busy} onClick={() => setConfirming(true)}>Review and send</button>
        </ActionBar>
      )}

      {confirming && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }} onKeyDown={(e) => { if (e.key === "Escape") setConfirming(false); }}>
          <div className="panel modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
            <h2 className="h2 !text-xl !font-normal" id="m-title">Send {sendable.length} {sendable.length === 1 ? "email" : "emails"}?</h2>
            <p className="muted small m-0">From {config?.from}. Only allowlisted addresses receive mail; others are skipped and reported.</p>
            <div className="flex max-h-60 flex-col gap-1.5 overflow-auto">
              {sendable.map((d) => { const c = contactOf(d); return <div key={d._id} className="ev bg-[var(--bg)]"><span><strong className="font-medium">{c?.name}</strong>, {companyOf(c)?.name}</span><span className="muted small">{d.subject}</span></div>; })}
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button className="btn sec" type="button" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn" type="button" autoFocus onClick={() => { setConfirming(false); setTab("pipeline"); onSend(sendable.map((d) => d._id)); }}>Send {sendable.length} {sendable.length === 1 ? "email" : "emails"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
