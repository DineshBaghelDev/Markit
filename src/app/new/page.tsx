"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { postForm, postJson } from "@/lib/post-json";
import {
  ActionBar, AppShell, ErrorNote, Progress, StepHeader, useAgentTask, type Step, type StepInfo,
} from "@/components/markit/app-shell";

type Details = { companyName: string; website: string; valueProposition: string; geography: string; objective: string; proofPoints: string };

// Inputs of the two recorded demo runs.
const EXAMPLES: { label: string; text: string; details: Details }[] = [
  {
    label: "Battery storage, UAE",
    text: "We manufacture commercial and industrial battery energy storage systems (BESS), 100 kWh to 5 MWh, with an energy management system for peak shaving, solar self-consumption and backup power.",
    details: { companyName: "VoltGrid Storage", website: "", valueProposition: "Cut peak demand charges and diesel backup costs, increase on-site solar usage and keep operations running during outages.", geography: "United Arab Emirates", objective: "Acquire first commercial and industrial customers in the UAE", proofPoints: "" },
  },
  {
    label: "Compliance SaaS, UK",
    text: "AuditPilot is a B2B SaaS platform that automates SOC 2 and ISO 27001 compliance: continuous control monitoring through integrations with AWS, Google Workspace, GitHub and HR systems, automated evidence collection, policy templates and auditor-ready reports.",
    details: { companyName: "AuditPilot", website: "", valueProposition: "Get audit-ready in weeks instead of months, cut manual evidence collection, and unblock enterprise deals that require security certifications.", geography: "United Kingdom", objective: "Win mid-market software and fintech customers preparing for their first SOC 2 or ISO 27001 audit", proofPoints: "" },
  },
];

const EMPTY: Details = { companyName: "", website: "", valueProposition: "", geography: "", objective: "", proofPoints: "" };
const FIELDS: [keyof Details, string][] = [
  ["companyName", "Company name"], ["website", "Website"], ["valueProposition", "Problem it solves"],
  ["geography", "Target geography"], ["objective", "Sales objective"], ["proofPoints", "Proof points"],
];
const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const STATUS_TEXT: Record<string, string> = {
  strategy_ready: "Strategy ready", icp_approved: "ICP approved", discovering: "Searching", prospects_ready: "Prospects ready",
  autopilot_queued: "Autopilot running", autopilot_prospects: "Autopilot running", autopilot_contacts: "Autopilot running", autopilot_drafts: "Autopilot running", autopilot_done: "Drafts ready", error: "Needs attention",
};

const LOCKED: Record<Step, StepInfo> = {
  business: { state: "active", note: "Ready" },
  strategy: { state: "locked", note: "Analyze your business first" },
  prospects: { state: "locked", note: "Approve your ICP first" },
  outreach: { state: "locked", note: "Find decision-makers first" },
  campaign: { state: "locked", note: "Approve at least one email first" },
};

export default function NewProject() {
  const router = useRouter();
  const projects = useQuery(api.projects.list);
  const task = useAgentTask();
  const [text, setText] = useState("");
  const [details, setDetails] = useState<Details>(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [autopilot, setAutopilot] = useState(false);
  const [hint, setHint] = useState("");
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function removeProject(id: string) {
    setDeleting(id);
    try {
      await postJson("/api/projects/delete", { projectId: id });
      toast("Project deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the project");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].filter((f, i, all) => all.findIndex((x) => x.name === f.name) === i);
    if (next.length > MAX_FILES) { toast(`Upload at most ${MAX_FILES} files.`); return; }
    if (next.reduce((n, f) => n + f.size, 0) > MAX_BYTES) { toast("Files must be under 4 MB in total."); return; }
    setFiles(next);
    setHint("");
  }

  async function analyze() {
    if (text.trim().length < 80 && !files.length) {
      setHint("Add a little more so the profile is accurate: what you sell, who buys it, any proof it works, and where you want customers. Two or three sentences is enough, or upload a document.");
      return;
    }
    const body = new FormData();
    body.append("product", text.trim());
    Object.entries(details).forEach(([k, v]) => body.append(k, v));
    files.forEach((f) => body.append("documents", f));
    const result = await task.run("strategy", autopilot ? "Starting autopilot" : "Analyzing your business", autopilot ? "Autopilot running" : "Profile ready",
      () => postForm<{ projectId: string }>(autopilot ? "/api/autopilot" : "/api/strategy", body));
    if (result) router.push(`/project/${result.projectId}${autopilot ? "#prospects" : "#business"}`);
  }

  const lines = [
    "Reading your description",
    ...(files.length ? [`Reading ${files.length} document${files.length > 1 ? "s" : ""}`] : []),
    ...(details.website.trim() ? ["Noting the website"] : []),
    "Identifying product category",
    "Extracting proof points",
    "Drafting the ideal customer profile",
    ...(autopilot ? ["Handing over to autopilot"] : []),
  ];

  return (
    <AppShell projectName="New project" steps={LOCKED} current="business">
      {task.busy ? (
        <>
          <StepHeader step={1} title="Reading your business" lede="Markit is building your profile." />
          <Progress lines={lines} />
          <section className="panel flex flex-col gap-3.5 p-6" aria-hidden="true">
            {[70, 90, 55, 80, 40].map((w) => <span key={w} className="sk" style={{ width: `${w}%` }} />)}
          </section>
        </>
      ) : (
        <>
          <StepHeader step={1} title="What do you sell, and where do you want to sell it?"
            lede="Paste a description in your own words, or upload a deck. Markit reads it and builds a business profile you can check and correct." />
          <ErrorNote message={task.error} />

          <section className="panel flex flex-col gap-3.5 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <label className="label" htmlFor="b-text">Describe your business</label>
              <span className="flex flex-wrap gap-3">
                {EXAMPLES.map((ex) => (
                  <button key={ex.label} className="link small" type="button"
                    onClick={() => { setText(ex.text); setDetails(ex.details); setOpen(true); setHint(""); toast(`Example loaded: ${ex.details.companyName}`); }}>
                    Use example: {ex.label}
                  </button>
                ))}
              </span>
            </div>
            <textarea className="inp bigtext" id="b-text" value={text} onChange={(e) => { setText(e.target.value); setHint(""); }}
              placeholder="What you sell, who buys it, proof that it works, and where you want to find customers." />
            {hint && <div className="hint" role="alert">{hint}</div>}

            <div className="flex flex-col gap-2">
              <span className="label">Company documents</span>
              <div className={`drop ${over ? "over" : ""}`} role="button" tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
                <strong className="font-medium">Drop a pitch deck, brochure or case study</strong>
                <span className="muted small">or click to browse. PDF, DOCX, TXT or MD, up to {MAX_FILES} files, 4 MB in total.</span>
              </div>
              <input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.md" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              {files.length > 0 && (
                <div className="chips">
                  {files.map((f) => (
                    <span key={f.name} className="chip">{f.name}<span className="muted small">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))}>×</button></span>
                  ))}
                </div>
              )}
            </div>

            <details className="more" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
              <summary>Add details (optional)</summary>
              <div className="fgrid">
                {FIELDS.map(([k, label]) => (
                  <div key={k} className="field">
                    <label className="label" htmlFor={`bf-${k}`}>{label}</label>
                    <input className="inp" id={`bf-${k}`} value={details[k]} onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </details>

            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3.5">
              <span className="label">How should Markit run?</span>
              <div className="modes" role="group" aria-label="Run mode">
                <button type="button" className="mode" aria-pressed={!autopilot} onClick={() => setAutopilot(false)}>
                  <span className="radio" /><span><strong>Guided</strong><span className="d">You approve the ICP, pick companies and people, and approve each email.</span></span>
                </button>
                <button type="button" className="mode" aria-pressed={autopilot} onClick={() => setAutopilot(true)}>
                  <span className="radio" /><span><strong>Autopilot</strong><span className="d">Runs every step and stops at drafts for your approval. Picks the top 5 companies scoring 60+.</span></span>
                </button>
              </div>
            </div>
          </section>

          <section id="projects" className="panel flex flex-col gap-1 px-6 pb-4 pt-5" aria-labelledby="h-projects">
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <h2 id="h-projects" className="h2">Your projects</h2>
              <span className="muted small">{projects?.length ?? 0} saved</span>
            </div>
            {projects === undefined ? <p className="muted small">Loading projects…</p> : projects.length === 0 ? (
              <p className="muted small">No projects yet. Your first one appears here.</p>
            ) : projects.map((p) => (
              <div key={p._id} className="flex items-center gap-2 border-b border-[var(--border)] last:border-b-0">
                <Link href={`/project/${p._id}`} className="flex flex-1 items-center justify-between gap-3 py-2.5 text-sm no-underline hover:bg-[var(--bg)]">
                  <span><strong className="font-medium">{p.name ?? p.profile?.companyName ?? "Untitled"}</strong> <span className="muted small">{p.input?.geography}</span></span>
                  <span className={`status ${p.status === "error" ? "s-replied" : p.status.includes("done") || p.status === "prospects_ready" ? "s-approved" : "s-draft"}`}>{STATUS_TEXT[p.status] ?? p.status.replaceAll("_", " ")}</span>
                </Link>
                {/* Two-step delete: the first click arms it, the second deletes. */}
                <button className={`btn sm ${confirmDelete === p._id ? "" : "ghost"}`} type="button" disabled={deleting === p._id}
                  aria-label={confirmDelete === p._id ? `Confirm deleting ${p.name ?? p.profile?.companyName ?? "project"}` : `Delete ${p.name ?? p.profile?.companyName ?? "project"}`}
                  onBlur={() => setConfirmDelete(null)}
                  onClick={() => (confirmDelete === p._id ? removeProject(p._id) : setConfirmDelete(p._id))}>
                  {deleting === p._id ? "Deleting…" : confirmDelete === p._id ? "Confirm" : "Delete"}
                </button>
              </div>
            ))}
          </section>

          <ActionBar msg={<span className="muted">Takes under a minute. You can edit everything afterwards.</span>}>
            <button className="btn" type="button" onClick={analyze}>{autopilot ? "Run autopilot" : "Analyze my business"}</button>
          </ActionBar>
        </>
      )}
    </AppShell>
  );
}
