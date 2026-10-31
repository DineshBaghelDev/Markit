"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { BloCanvas } from "./blo";
import { agentStore, type BloExpr } from "./blo-engine";

export const STEPS = [
  ["business", "Business"],
  ["strategy", "Strategy"],
  ["prospects", "Prospects"],
  ["outreach", "Outreach"],
  ["campaign", "Campaign"],
] as const;
export type Step = (typeof STEPS)[number][0];
export type StepState = "locked" | "active" | "need" | "done" | "stale";
export type StepInfo = { state: StepState; note: string };

const CHECK = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const LOCK = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
);
const MAIL = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
export const Icons = { check: CHECK, lock: LOCK, mail: MAIL };

// Sidebar stepper + top bar, as in the updated prototype.
export function AppShell({ projectName, tag, steps, current, onStep, onRename, children }: {
  projectName: string;
  tag?: string;
  steps: Record<Step, StepInfo>;
  current: Step;
  onStep?: (step: Step) => void;
  onRename?: (name: string) => void;
  children: ReactNode;
}) {
  const agent = useSyncExternalStore(agentStore.subscribe, agentStore.get, agentStore.get);
  return (
    <div className="app">
      <aside className="side" aria-label="Project">
        <Link className="logo" href="/">markit<i>.</i></Link>
        <div className="proj"><span className="flex items-center justify-between gap-2"><span className="label">Project</span>{tag && <span className="status s-prepared">{tag}</span>}</span><b>{projectName}</b></div>
        <nav aria-label="Steps">
          <ol className="steps">
            {STEPS.map(([key, name], i) => {
              const { state, note } = steps[key];
              const icon = state === "done" ? CHECK : state === "locked" ? LOCK : state === "need" ? "!" : state === "stale" ? "↻" : i + 1;
              return (
                <li key={key}>
                  <a
                    className={`step ${state}`} href={`#${key}`}
                    aria-current={key === current ? "page" : undefined}
                    aria-disabled={state === "locked" || undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (state === "locked") { toast(note); return; }
                      if (agentStore.get().running) { toast("Markit is working. One moment."); return; }
                      onStep?.(key);
                    }}
                  >
                    <span className="ic">{icon}</span>
                    <span className="tx"><span className="nm">{name}</span><span className="st">{note}</span></span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="user">
          <nav className="side-nav" aria-label="Projects">
            <Link href="/new">+ New project</Link>
            <Link href="/new#projects">All projects</Link>
          </nav>
        </div>
      </aside>
      <div className="mainwrap">
        <header className="topbar">
          {onRename ? (
            <>
              <label className="sr" htmlFor="pname">Project name</label>
              <input className="pname" id="pname" key={projectName} defaultValue={projectName} size={Math.max(12, projectName.length + 2)} title="Click to rename"
                onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== projectName) onRename(v); else e.currentTarget.value = projectName; }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = projectName; e.currentTarget.blur(); } }} />
            </>
          ) : <span className="pname">{projectName}</span>}
          <div className="runline" aria-live="polite"><BloCanvas tone="mark" grid={18} expr={agent.expr} /><span>{agent.text}</span></div>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}

export function StepHeader({ step, title, lede }: { step: number; title: string; lede?: string }) {
  return (
    <header className="flex flex-col gap-2.5">
      <span className="label">Step {step} of 5</span>
      <h1 className="h1">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

export function EmptyState({ title, text, action, onAction, expr = "default" }: {
  title: string; text: string; action?: string; onAction?: () => void; expr?: BloExpr;
}) {
  return (
    <div className="panel empty">
      <BloCanvas grid={24} expr={expr} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && <button className="btn" type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

// Agent progress log. Lines tick on a timer while the request runs; the last stays running until it returns.
export function Progress({ lines }: { lines: string[] }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= lines.length - 1) return;
    const id = setTimeout(() => setDone((n) => n + 1), 900 + Math.random() * 600);
    return () => clearTimeout(id);
  }, [done, lines.length]);
  return (
    <div className="panel progress">
      <BloCanvas grid={24} expr={done >= Math.floor(lines.length / 2) ? "focused" : "thinking"} />
      <div className="log" role="log" aria-label="Agent progress">
        {lines.slice(0, done + 1).map((line, i) => (
          <div key={line} className={i < done ? "done" : "run"}><i>{i < done ? "✓" : "◌"}</i><span>{line}</span></div>
        ))}
      </div>
    </div>
  );
}

export function Banner({ kind, children, action }: { kind: "ok" | "warn" | "err"; children: ReactNode; action?: ReactNode }) {
  return <div className={`banner ${kind}`} role={kind === "err" ? "alert" : "status"}><span>{children}</span>{action}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <Banner kind="err"><strong>That didn’t work.</strong> {message}</Banner>;
}

export function ActionBar({ msg, children }: { msg: ReactNode; children?: ReactNode }) {
  return <div className="actionbar"><span className="msg">{msg}</span>{children && <div className="flex flex-wrap gap-2.5">{children}</div>}</div>;
}

const STATUS_CLS = { Draft: "s-draft", Edited: "s-edited", Approved: "s-approved", Prepared: "s-prepared", Exported: "s-prepared", Sent: "s-sent", Replied: "s-replied" } as const;
export type StatusName = keyof typeof STATUS_CLS;
export function StatusChip({ status }: { status: StatusName }) {
  return <span className={`status ${STATUS_CLS[status]}`}>{status}</span>;
}

export const scoreClass = (s: number) => (s >= 80 ? "sc-hi" : s >= 60 ? "sc-mid" : "sc-lo");
export function ScorePill({ score }: { score?: number }) {
  if (score == null) return <span className="score sc-lo">–</span>;
  return <span className={`score ${scoreClass(score)}`} aria-label={`Score ${score} of 100`}>{score}</span>;
}

// Runs one pipeline task, drives the agent status, and tracks busy/error state.
export function useAgentTask() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Returns the route's result on success (null on failure) and surfaces any pipeline warnings as toasts.
  async function run<T>(name: string, status: string, doneText: string, fn: () => Promise<T>): Promise<T | null> {
    // Never ignore a click silently: say why nothing started.
    if (busy || agentStore.get().running) { toast("Markit is still working on the previous step. Try again when it finishes."); return null; }
    setBusy(name);
    setError("");
    agentStore.set({ running: true, expr: "thinking", text: status });
    try {
      const result = await fn();
      const warnings = (result as { warnings?: unknown } | null)?.warnings;
      if (Array.isArray(warnings)) warnings.forEach((w) => toast(String(w)));
      agentStore.set({ running: false, expr: "happy", text: doneText });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      // The error note sits at the top of the step; the toast is visible wherever the user is.
      toast(message);
      agentStore.set({ running: false, expr: "surprised", text: "Something went wrong" });
      return null;
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
