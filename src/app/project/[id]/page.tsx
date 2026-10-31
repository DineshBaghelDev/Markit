"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { BusinessProfile, ParsedBusinessInput } from "@/lib/schemas";
import { postJson } from "@/lib/post-json";
import { agentStore } from "@/components/markit/blo-engine";
import { AppShell, Banner, EmptyState, ErrorNote, STEPS, useAgentTask, type Step, type StepInfo } from "@/components/markit/app-shell";
import { ProfileStep } from "./profile-step";
import { StrategyStep } from "./strategy-step";
import { ProspectsStep } from "./prospects-step";
import { OutreachStep } from "./outreach-step";
import { CampaignStep } from "./campaign-step";

const ALIASES: Record<string, Step> = { profile: "business" };
const toStep = (h: string): Step | null => ALIASES[h] ?? (STEPS.some(([k]) => k === h) ? (h as Step) : null);

// The active step lives in the URL hash so steps are linkable and survive refresh.
function useHashStep() {
  const [step, setStep] = useState<Step>("business");
  useEffect(() => {
    const sync = () => { const s = toStep(location.hash.slice(1)); if (s) setStep(s); };
    sync();
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  const go = useCallback((next: Step) => {
    if (location.hash !== `#${next}`) location.hash = next;
    setStep(next);
    scrollTo(0, 0);
  }, []);
  return [step, go] as const;
}

const SERVER_RUNNING = ["discovering", "autopilot_contacts", "autopilot_drafts"];
const AUTOPILOT_STAGES = ["ICP approved", "Find and score companies", "Pick decision-makers", "Write drafts"];
const STAGE_BY_STATUS: Record<string, number> = { discovering: 1, autopilot_contacts: 2, autopilot_drafts: 3, autopilot_done: 4 };

function stepStates(project: Doc<"projects">, companies: Doc<"companies">[], contacts: Doc<"contacts">[], drafts: Doc<"drafts">[]): Record<Step, StepInfo> {
  const approvedDrafts = drafts.filter((d) => d.status !== "draft");
  const sent = drafts.filter((d) => d.status === "sent").length;
  return {
    business: { state: "done", note: "Profile ready" },
    strategy: project.icpApproved ? { state: "done", note: "ICP approved" } : { state: "need", note: "Needs approval" },
    prospects: !project.icpApproved && !companies.length ? { state: "locked", note: "Approve your ICP first" }
      : contacts.length ? { state: "done", note: `${companies.filter((c) => c.selected).length} chosen, ${contacts.length} people` }
      : companies.length ? { state: "active", note: `${companies.length} companies found` } : { state: "active", note: "Ready to search" },
    outreach: !contacts.length && !drafts.length ? { state: "locked", note: "Find decision-makers first" }
      : !drafts.length ? { state: "active", note: "Ready to draft" }
      : approvedDrafts.length === drafts.length ? { state: "done", note: "All approved" } : { state: "need", note: `${approvedDrafts.length} of ${drafts.length} approved` },
    campaign: !approvedDrafts.length ? { state: "locked", note: "Approve at least one email first" }
      : sent ? { state: "done", note: `${sent} sent` } : { state: "active", note: "Ready to send" },
  };
}

export default function ProjectPage() {
  const projectId = useParams<{ id: string }>().id as Id<"projects">;
  const project = useQuery(api.projects.get, { id: projectId });
  const companies = useQuery(api.companies.listByProject, { projectId });
  const contacts = useQuery(api.contacts.listByProject, { projectId });
  const drafts = useQuery(api.drafts.listByProject, { projectId });
  const convex = useConvex();
  const approveIcp = useMutation(api.projects.approveIcp);
  const rename = useMutation(api.projects.rename);
  const setContactSelected = useMutation(api.contacts.setSelected);
  const router = useRouter();
  const task = useAgentTask();
  const [step, go] = useHashStep();
  const status = project?.status ?? "";
  const serverRunning = !task.busy && SERVER_RUNNING.includes(status);

  // Mirror server-side runs (autopilot, or a search started elsewhere) in the agent status and cursor.
  useEffect(() => {
    if (serverRunning) agentStore.set({ running: true, expr: "thinking", text: status === "discovering" ? "Searching Crustdata" : "Autopilot running" });
    else if (agentStore.get().running && !task.busy) agentStore.set({ running: false, expr: status === "autopilot_done" ? "proud" : "happy", text: status === "autopilot_done" ? "Drafts ready for approval" : "Ready" });
  }, [serverRunning, status, task.busy]);

  if (!project || !companies || !contacts || !drafts) {
    const locked = Object.fromEntries(STEPS.map(([k]) => [k, { state: "locked", note: "Loading" }])) as Record<Step, StepInfo>;
    return (
      <AppShell projectName="Project" steps={locked} current={step}>
        {project === null
          ? <EmptyState title="Project not found" text="This project doesn’t exist any more." action="Start a new project" onAction={() => router.push("/new")} expr="surprised" />
          : <EmptyState title="Loading your project" text="One moment." expr="thinking" />}
      </AppShell>
    );
  }

  const input = project.input as ParsedBusinessInput;
  const profile = project.profile as BusinessProfile;
  const call = (url: string, extra: object = {}) => () => postJson<{ warnings?: string[] }>(url, { projectId, ...extra });

  const discover = () => { go("prospects"); task.run("discover", "Searching Crustdata", "Prospects ranked", call("/api/discover")); };
  const approveAndSearch = async () => { await approveIcp({ id: projectId }); toast("ICP approved"); discover(); };
  const findPeople = () => task.run("contacts", "Finding decision-makers", "Decision-makers found", async () => {
    const result = await call("/api/contacts")();
    // Include the best-ranked person per company by default; the user can skip or include others.
    const found = await convex.query(api.contacts.listByProject, { projectId });
    const first = found.filter((c, i) => found.findIndex((x) => x.companyId === c.companyId) === i);
    await Promise.all(first.map((c) => setContactSelected({ id: c._id, selected: true })));
    return result;
  });
  const draftAll = async () => { go("outreach"); await task.run("drafts", "Drafting emails", "Drafts ready for approval", call("/api/outreach")); };
  const write = (contactId?: Id<"contacts">) => contactId
    ? task.run(`regen-${contactId}`, "Rewriting the email", "Email rewritten", call("/api/outreach", { contactId }))
    : draftAll();
  const enrich = () => task.run("enrich", "Looking up work emails", "Emails checked", async () => {
    const result = await postJson<{ enriched: number; requested: number; warning?: string }>("/api/enrich", { projectId });
    toast(result.warning ?? `Found ${result.enriched} of ${result.requested} work emails`);
    return result;
  });
  const send = (draftIds: Id<"drafts">[]) => task.run("send", "Sending your emails", "Emails sent", async () => {
    const result = await postJson<{ sent: number; results: { outcome: string; to?: string; reason?: string }[] }>("/api/send", { projectId, draftIds });
    const skipped = result.results.filter((r) => r.outcome !== "sent");
    toast(`Sent ${result.sent} email${result.sent === 1 ? "" : "s"}${skipped.length ? `, ${skipped.length} not sent` : ""}`);
    skipped.forEach((r) => toast(`${r.to ?? "Contact"}: ${r.reason ?? r.outcome}`));
    return result;
  });

  const stage = STAGE_BY_STATUS[status];
  const name = project.name ?? ([profile?.companyName, input?.geography].filter(Boolean).join(", ") || "Project");

  return (
    <AppShell projectName={name} steps={stepStates(project, companies, contacts, drafts)} current={step} onStep={go}
      onRename={async (v) => { await rename({ id: projectId, name: v }); toast("Project renamed"); }}>
      {status === "error" && project.error && <ErrorNote message={`Last run failed: ${project.error}`} />}
      {(serverRunning || status === "autopilot_done") && stage !== undefined && (
        <Banner kind={status === "autopilot_done" ? "ok" : "warn"}
          action={status === "autopilot_done" ? <button className="btn sm" type="button" onClick={() => go("outreach")}>Review drafts</button> : undefined}>
          <strong className="font-semibold">{status === "autopilot_done" ? "Autopilot finished." : status === "discovering" ? "Searching Crustdata." : "Autopilot running."}</strong>{" "}
          {AUTOPILOT_STAGES.map((s, i) => `${i < stage ? "✓" : i === stage ? "◌" : "·"} ${s}`).join("   ")}
          {status === "autopilot_done" && " Every draft waits for your approval."}
        </Banner>
      )}
      {step === "business" && <ProfileStep project={project} onNext={() => go("strategy")} />}
      {step === "strategy" && (
        <StrategyStep project={project} hasCompanies={companies.length > 0} busy={!!task.busy || serverRunning} error={task.error}
          onApproveAndSearch={approveAndSearch} onSearch={discover} onViewProspects={() => go("prospects")} />
      )}
      {step === "prospects" && (
        <ProspectsStep project={project} companies={companies} contacts={contacts} error={task.error}
          busy={task.busy ?? (status === "discovering" ? "discover" : status === "autopilot_contacts" ? "contacts" : null)}
          onGoStrategy={() => go("strategy")} onDiscover={discover} onFindPeople={findPeople} onDraft={draftAll} onEnrich={enrich} />
      )}
      {step === "outreach" && (
        <OutreachStep companies={companies} contacts={contacts} drafts={drafts} error={task.error}
          busy={task.busy ?? (status === "autopilot_drafts" ? "drafts" : null)}
          onGoProspects={() => go("prospects")} onWrite={write} onNext={() => go("campaign")} />
      )}
      {step === "campaign" && (
        <CampaignStep companies={companies} contacts={contacts} drafts={drafts} busy={task.busy} onGoOutreach={() => go("outreach")} onSend={send} />
      )}
    </AppShell>
  );
}
