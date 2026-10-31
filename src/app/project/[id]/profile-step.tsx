"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type { BusinessProfile, ParsedBusinessInput } from "@/lib/schemas";
import { ActionBar, StepHeader } from "@/components/markit/app-shell";

// Click-to-edit field: view, hover (pencil), edit, saved flash. Enter saves, Escape cancels.
function Editable({ value, name, multi, onSave }: { value: string; name: string; multi?: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const finish = (next: string | null) => {
    setEditing(false);
    if (next === null) return;
    const v = next.trim();
    if (v === value.trim()) return;
    onSave(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 900);
  };
  if (editing) {
    const common = {
      className: "inp", autoFocus: true, defaultValue: value, "aria-label": name,
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => finish(e.currentTarget.value),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === "Escape") { e.preventDefault(); finish(null); }
        if (e.key === "Enter" && (!multi || e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(e.currentTarget.value); }
      },
    };
    return <div className="ef">{multi ? <textarea rows={3} {...common} /> : <input {...common} />}</div>;
  }
  return (
    <div className={`ef ${value ? "" : "empty-val"} ${saved ? "saved" : ""}`} role="button" tabIndex={0} aria-label={`Edit ${name}: ${value || "not provided"}`}
      onClick={() => setEditing(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); } }}>
      {value || "Not provided"}
    </div>
  );
}

export function ProfileStep({ project, onNext }: { project: Doc<"projects">; onNext: () => void }) {
  const updateProfile = useMutation(api.projects.updateProfile);
  const input = project.input as ParsedBusinessInput;
  const profile = project.profile as BusinessProfile;
  const proof = profile.proofPoints ?? [];
  const documents = input.documents ?? [];

  const save = async (patch: Partial<BusinessProfile>) => {
    await updateProfile({ id: project._id, profile: { ...profile, ...patch } });
    toast("Saved. Later steps use the corrected profile.");
  };

  const rows: [keyof BusinessProfile, string, boolean][] = [
    ["companyName", "Company", false],
    ["offering", "Category", false],
    ["valueProposition", "One-line value", true],
    ["problemSolved", "Problem solved", true],
    ["summary", "Summary", true],
    ["salesObjective", "Sales objective", false],
  ];

  return (
    <>
      <StepHeader step={1} title="Here’s what Markit understood" lede="Click any field to correct it. Everything after this step is built from this profile." />
      <div className="reveal flex flex-col gap-5">
        <section className="panel flex flex-col gap-[22px] p-6" aria-labelledby="h-prof">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="h2" id="h-prof">Business profile</h2>
            <Link className="link small" href="/new">Start over</Link>
          </div>
          <div className="kv">
            {rows.map(([key, label, multi]) => (
              <div key={key} className="contents">
                <span className="label pt-1.5">{label}</span>
                <Editable value={String(profile[key] ?? "")} name={label} multi={multi} onSave={(v) => save({ [key]: v })} />
              </div>
            ))}
            <span className="label">Target geography</span>
            <div className="pt-1">{input.geography || <span className="muted">Inferred from your description. See the strategy step.</span>}</div>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="label">Proof points</span>
            {proof.length ? (
              <div className="tiles">
                {proof.map((p, i) => (
                  <div key={`${p}-${i}`} className="tile">
                    <Editable value={p} name="Proof point" multi onSave={(v) => save({ proofPoints: v ? proof.map((x, j) => (j === i ? v : x)) : proof.filter((_, j) => j !== i) })} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small m-0">None found. Emails leave a [bracketed] placeholder instead of inventing a result.</p>
            )}
            <input className="add" placeholder="+ Add proof" aria-label="Add a proof point"
              onKeyDown={(e) => {
                const v = e.currentTarget.value.trim();
                if (e.key !== "Enter" || !v) return;
                e.preventDefault(); e.currentTarget.value = "";
                save({ proofPoints: [...proof, v] });
              }} />
          </div>
        </section>

        <section className="panel flex flex-col gap-3 p-6" aria-labelledby="h-src">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="h2" id="h-src">What Markit read</h2>
            <span className="muted small">The profile restates this input. It is not researched.</span>
          </div>
          {input.product && <p className="m-0 text-sm leading-relaxed">{input.product}</p>}
          {documents.length > 0 && (
            <div className="chips">{documents.map((d) => <span key={d.name} className="chip">{d.name}{d.truncated && <span className="muted small">trimmed</span>}</span>)}</div>
          )}
          {[input.valueProposition, input.objective, input.proofPoints].some(Boolean) && (
            <details className="how">
              <summary>Other details you gave</summary>
              <div className="kv mt-2.5">
                {input.valueProposition && (<><span className="label">Problem</span><span>{input.valueProposition}</span></>)}
                {input.objective && (<><span className="label">Objective</span><span>{input.objective}</span></>)}
                {input.proofPoints && (<><span className="label">Proof points</span><span>{input.proofPoints}</span></>)}
              </div>
            </details>
          )}
        </section>
      </div>
      <ActionBar msg={<span className="muted">Editing this profile changes what later drafts may say. Your ICP stays as approved.</span>}>
        <button className="btn" type="button" onClick={onNext}>Continue to strategy</button>
      </ActionBar>
    </>
  );
}
