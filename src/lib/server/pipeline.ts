import "server-only";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { buildCompanyQueries, buildPeopleAtCompanyQuery, dedupeCompanies } from "@/lib/crustdata-filters";
import { parseStoredIcp, parseStoredProfile, type ParsedBusinessInput } from "@/lib/schemas";
import { getPath, scoreQualification } from "@/lib/scoring";
import { generateDraft, generateStrategy, pickDecisionMakers, qualifyCompanies } from "@/lib/server/ai";
import { demoPause, demoTemplateFor, replayCompanies, replayContacts, replayDrafts } from "@/lib/server/demo-replay";
import { DAILY_SEND_LIMIT, emailConfig, finalizeBody, isAllowedRecipient, sendEmail } from "@/lib/server/email";
import {
  CrustdataError, companyAutocomplete, companySearch, enrichBusinessEmails, personSearch, type CrustdataCompany,
} from "@/lib/server/crustdata";

type ProjectId = Id<"projects">;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function loadProject(id: ProjectId) {
  const project = await fetchQuery(api.projects.get, { id });
  if (!project) throw new Error("Project not found");
  return { project, icp: parseStoredIcp(project.icp), profile: parseStoredProfile(project.profile) };
}

const setStatus = (id: ProjectId, status: string, error?: string) =>
  fetchMutation(api.projects.setStatus, { id, status, error });

// Steps 1-3: business understanding, ICP and market insights in one model call.
export async function createProject(input: ParsedBusinessInput): Promise<ProjectId> {
  const template = await demoTemplateFor(input);
  if (template) {
    await demoPause();
    const { input: tIn, profile, icp, insights } = template;
    return fetchMutation(api.projects.create, { input: tIn, profile, icp, insights, demoOf: template._id });
  }
  const strategy = await generateStrategy(input);
  return fetchMutation(api.projects.create, { input, ...strategy });
}

// Record fields sent to the model; logos are dropped and long descriptions trimmed.
function compact(company: CrustdataCompany) {
  const { basic_info, headcount, funding, locations, taxonomy, revenue, hiring, followers } =
    company as Record<string, unknown>;
  const info = { ...(basic_info as Record<string, unknown> | undefined) };
  delete info.logo_permalink;
  if (typeof info.description === "string") info.description = info.description.slice(0, 700);
  return {
    crustdata_company_id: company.crustdata_company_id,
    basic_info: info, headcount, funding, locations, taxonomy, revenue, hiring, followers,
  };
}

const resolveIndustries = async (industries: string[]) => [...new Set((await Promise.all(
  industries.map((i) => companyAutocomplete("taxonomy.professional_network_industry", i, 2)),
)).flat())];

// Steps 4-5: ICP -> Crustdata searches -> dedupe -> LLM qualification -> stored ranked prospects.
// Individual search or scoring failures are tolerated and reported; the step fails only if nothing is found.
export async function discoverProspects(id: ProjectId) {
  const { project, icp, profile } = await loadProject(id);
  if (!project.icpApproved) throw new Error("Approve the ICP before discovering companies.");
  await setStatus(id, "discovering");
  if (project.demoOf) {
    await demoPause();
    const count = await replayCompanies(project);
    await setStatus(id, "prospects_ready");
    return { count, warnings: [] as string[] };
  }
  const warnings: string[] = [];

  try {
    const countries = [...new Set((await Promise.all(
      icp.countries.map((c) => companyAutocomplete("locations.country", c, 1)),
    )).flat())];
    if (!countries.length) throw new Error(`Could not match target countries (${icp.countries.join(", ")}) to Crustdata.`);
    const unmatched = icp.countries.length - countries.length;
    if (unmatched > 0) warnings.push(`${unmatched} target country name(s) had no Crustdata match.`);

    // Segments without a semantic description (older projects) use autocomplete-resolved industry filters.
    const segments = await Promise.all(icp.segments.map(async (s) => ({
      name: s.name,
      searchQuery: s.searchQuery,
      industries: s.searchQuery.trim() ? [] : await resolveIndustries(s.industries),
    })));
    const queries = buildCompanyQueries(icp, segments, countries);

    const settled = await Promise.allSettled(queries.map(async ({ segment, query }) => {
      let { companies, cached } = await companySearch(query);
      // Semantic search can miss; fall back to industry filters for this segment.
      if (!companies.length && query.search) {
        const industries = await resolveIndustries(icp.segments.find((s) => s.name === segment)?.industries ?? []);
        const [fallback] = buildCompanyQueries(icp, [{ name: segment, searchQuery: "", industries }], countries);
        if (fallback) ({ companies, cached } = await companySearch(fallback.query));
        warnings.push(`Semantic search found nothing for "${segment}"; used industry filters.`);
      }
      return companies.map((company) => ({ ...company, segment, cached }));
    }));
    settled.forEach((r, i) => r.status === "rejected" && warnings.push(`Search failed for "${queries[i].segment}": ${errorText(r.reason)}`));
    const unique = dedupeCompanies(settled.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
    if (!unique.length) throw new Error(`No companies found. ${warnings.join(" ")}`.trim());

    const records = unique.map(compact);
    const BATCH = 12;
    const batches = Array.from({ length: Math.ceil(records.length / BATCH) }, (_, i) => records.slice(i * BATCH, (i + 1) * BATCH));
    const scored = await Promise.allSettled(batches.map((b) => qualifyCompanies(profile, icp, b)));
    scored.forEach((r) => r.status === "rejected" && warnings.push(`Qualification failed for a batch: ${errorText(r.reason)}`));
    const byId = new Map(scored.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).map((q) => [q.companyId, q]));

    const companies = unique.map((company, index) => {
      const q = byId.get(company.crustdata_company_id);
      const qualification = q ? scoreQualification(q, records[index]) : undefined;
      return {
        crustdataId: company.crustdata_company_id,
        name: company.basic_info?.name ?? `Company ${company.crustdata_company_id}`,
        domain: company.basic_info?.primary_domain ?? undefined,
        segment: company.segment,
        data: records[index],
        score: qualification?.score,
        qualification,
        source: company.cached ? ("fixture" as const) : ("live" as const),
      };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    await fetchMutation(api.companies.replaceForProject, { projectId: id, companies });
    await setStatus(id, "prospects_ready", warnings.length ? warnings.join(" ") : undefined);
    return { count: companies.length, warnings };
  } catch (error) {
    await setStatus(id, "error", errorText(error));
    throw error;
  }
}

// Step 6: people at selected companies (target countries first) -> LLM picks those matching buyer roles.
export async function findDecisionMakers(id: ProjectId) {
  const { project, icp, profile } = await loadProject(id);
  if (project.demoOf) { await demoPause(); return { count: await replayContacts(project), warnings: [] as string[] }; }
  const selected = (await fetchQuery(api.companies.listByProject, { projectId: id })).filter((c) => c.selected);
  if (!selected.length) throw new Error("Select at least one company.");

  const settled = await Promise.allSettled(selected.map(async (company) => {
    let { profiles, cached } = await personSearch(buildPeopleAtCompanyQuery(company.crustdataId, icp.countries));
    if (!profiles.length) ({ profiles, cached } = await personSearch(buildPeopleAtCompanyQuery(company.crustdataId)));
    const candidates = profiles.map((person) => {
      // A person can hold several current roles; use the one at this company.
      const role = person.experience?.employment_details?.current
        ?.find((r) => r.crustdata_company_id === company.crustdataId);
      return {
        person,
        personId: person.crustdata_person_id,
        name: person.basic_profile?.name ?? "Unknown",
        title: role?.title ?? person.basic_profile?.current_title ?? "",
      };
    });
    const picks = await pickDecisionMakers(profile, icp, company.name,
      candidates.map(({ personId, name, title }) => ({ personId, name, title })));
    return picks.flatMap((pick) => {
      const candidate = candidates.find((c) => c.personId === pick.personId);
      if (!candidate) return [];
      return [{
        companyId: company._id,
        crustdataPersonId: candidate.personId,
        name: candidate.name,
        title: candidate.title,
        profileUrl: candidate.person.social_handles?.professional_network_identifier?.profile_url ?? undefined,
        emailStatus: "not_enriched" as const,
        relevance: pick.relevance,
        source: cached ? ("fixture" as const) : ("live" as const),
      }];
    });
  }));

  const warnings = settled.flatMap((r, i) =>
    r.status === "rejected" ? [`People search failed for ${selected[i].name}: ${errorText(r.reason)}`] : []);
  const contacts = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!contacts.length && warnings.length) throw new Error(warnings.join(" "));
  await fetchMutation(api.contacts.replaceForProject, { projectId: id, contacts });
  return { count: contacts.length, warnings };
}

// Enrichment is spent only on selected contacts. Permission errors mark emails unavailable instead of failing.
export async function enrichSelectedContacts(id: ProjectId) {
  const demo = (await fetchQuery(api.projects.get, { id }))?.demoOf;
  if (demo) await demoPause();
  const contacts = (await fetchQuery(api.contacts.listByProject, { projectId: id }))
    .filter((c) => c.selected && c.emailStatus === "not_enriched");
  const urls = contacts.flatMap((c) => (c.profileUrl ? [c.profileUrl] : []));
  let emails = new Map<string, string>();
  let warning: string | undefined;
  try {
    if (urls.length && !demo) emails = await enrichBusinessEmails(urls);
  } catch (error) {
    if (!(error instanceof CrustdataError) || error.status !== 403) throw error;
    warning = "Email enrichment is not available on the current Crustdata plan.";
  }
  await fetchMutation(api.contacts.setEmails, {
    updates: contacts.map((c) => ({ id: c._id, email: c.profileUrl ? emails.get(c.profileUrl) : undefined })),
  });
  return { enriched: emails.size, requested: contacts.length, warning };
}

// Step 7: one draft per selected contact (or one contact when regenerating), with verified citations.
export async function writeDrafts(id: ProjectId, contactId?: string) {
  const { project, icp, profile } = await loadProject(id);
  if (project.demoOf) { await demoPause(); return { count: await replayDrafts(project, contactId), warnings: [] as string[] }; }
  const [companies, contacts] = await Promise.all([
    fetchQuery(api.companies.listByProject, { projectId: id }),
    fetchQuery(api.contacts.listByProject, { projectId: id }),
  ]);
  const targets = contacts.filter((c) => (contactId ? c._id === contactId : c.selected));
  if (!targets.length) throw new Error("Select at least one contact.");
  // Proof points the user typed plus those extracted from uploaded documents during strategy.
  const typed = typeof project.input?.proofPoints === "string" ? project.input.proofPoints : "";
  const proofPoints = [typed, ...profile.proofPoints].filter(Boolean).join("; ");

  const settled = await Promise.allSettled(targets.map(async (contact) => {
    const company = companies.find((c) => c._id === contact.companyId);
    const { citations, ...draft } = await generateDraft({
      profile, icp, proofPoints,
      company: company?.data,
      qualification: company?.qualification,
      contact: { name: contact.name, title: contact.title, relevance: contact.relevance },
    });
    // Keep only citations that resolve to a real field in the Crustdata record.
    const verified = citations.flatMap((c) => {
      const raw = getPath(company?.data, c.field);
      if (raw === undefined || raw === null || raw === "") return [];
      return [{ ...c, value: (typeof raw === "string" ? raw : JSON.stringify(raw)).slice(0, 200) }];
    });
    await fetchMutation(api.drafts.upsert, { projectId: id, contactId: contact._id, ...draft, citations: verified });
  }));
  const warnings = settled.flatMap((r, i) =>
    r.status === "rejected" ? [`Draft failed for ${targets[i].name}: ${errorText(r.reason)}`] : []);
  if (warnings.length === targets.length) throw new Error(warnings.join(" "));
  return { count: targets.length - warnings.length, warnings };
}

// Autopilot: the full pipeline without manual steps. Selection rules are fixed and explainable:
// top prospects scoring at least AUTO_MIN_SCORE (max AUTO_COMPANIES), then the best-ranked contact per company.
const AUTO_COMPANIES = 5;
const AUTO_MIN_SCORE = 60;

export async function runAutopilot(id: ProjectId) {
  const log: string[] = [];
  try {
    await fetchMutation(api.projects.approveIcp, { id });
    log.push("ICP auto-approved.");

    const discovery = await discoverProspects(id);
    log.push(`Discovered and scored ${discovery.count} companies.`, ...discovery.warnings);

    const companies = await fetchQuery(api.companies.listByProject, { projectId: id });
    const picked = companies.filter((c) => (c.score ?? 0) >= AUTO_MIN_SCORE)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, AUTO_COMPANIES);
    if (!picked.length) throw new Error(`No company scored ${AUTO_MIN_SCORE}+; review the ICP.`);
    await Promise.all(picked.map((c) => fetchMutation(api.companies.setSelected, { id: c._id, selected: true })));
    log.push(`Selected ${picked.length} companies scoring ${AUTO_MIN_SCORE}+: ${picked.map((c) => c.name).join(", ")}.`);
    await setStatus(id, "autopilot_contacts");

    const people = await findDecisionMakers(id);
    log.push(`Found ${people.count} decision-makers.`, ...people.warnings);
    const contacts = await fetchQuery(api.contacts.listByProject, { projectId: id });
    // Contacts are stored in the model's ranked order, so the first per company is the best pick.
    const firstPerCompany = contacts.filter((c, i) => contacts.findIndex((x) => x.companyId === c.companyId) === i);
    await Promise.all(firstPerCompany.map((c) => fetchMutation(api.contacts.setSelected, { id: c._id, selected: true })));
    log.push(`Selected the top contact at ${firstPerCompany.length} companies.`);

    const enrichment = await enrichSelectedContacts(id);
    log.push(enrichment.warning ?? `Enriched ${enrichment.enriched}/${enrichment.requested} emails.`);
    await setStatus(id, "autopilot_drafts");

    const drafts = await writeDrafts(id);
    log.push(`Wrote ${drafts.count} drafts (awaiting human approval before export).`, ...drafts.warnings);
    await setStatus(id, "autopilot_done", log.join(" "));
    return { log };
  } catch (error) {
    log.push(`Stopped: ${errorText(error)}`);
    await setStatus(id, "error", log.join(" "));
    throw error;
  }
}

// Step 8: send approved drafts. Only allowlisted addresses receive mail; each draft is sent at most once;
// status becomes "sent" only after Gmail accepts the message.
export async function sendApprovedDrafts(id: ProjectId, draftIds?: string[]) {
  const { profile } = await loadProject(id);
  const { allowlist } = emailConfig();
  const [drafts, contacts] = await Promise.all([
    fetchQuery(api.drafts.listByProject, { projectId: id }),
    fetchQuery(api.contacts.listByProject, { projectId: id }),
  ]);
  const sentToday = drafts.filter((d) => d.sentAt && Date.now() - d.sentAt < 86_400_000).length;
  const candidates = drafts.filter((d) => (draftIds ? draftIds.includes(d._id) : true) && d.status !== "sent");

  const results: { draftId: string; to?: string; outcome: "sent" | "skipped" | "failed"; reason?: string }[] = [];
  let budget = DAILY_SEND_LIMIT - sentToday;
  for (const draft of candidates) {
    const contact = contacts.find((c) => c._id === draft.contactId);
    const skip = (reason: string) => results.push({ draftId: draft._id, to: contact?.email, outcome: "skipped", reason });
    if (draft.status !== "approved" && draft.status !== "exported") { skip("Not approved"); continue; }
    if (!contact?.email) { skip("No email address"); continue; }
    if (!isAllowedRecipient(contact.email, allowlist)) { skip("Recipient not on EMAIL_ALLOWLIST"); continue; }
    if (budget <= 0) { skip(`Daily limit of ${DAILY_SEND_LIMIT} reached`); continue; }
    try {
      const messageId = await sendEmail({
        to: contact.email,
        subject: draft.subject,
        body: finalizeBody(draft.body),
        fromName: profile.companyName,
      });
      await fetchMutation(api.drafts.markSent, { id: draft._id, messageId });
      budget--;
      results.push({ draftId: draft._id, to: contact.email, outcome: "sent" });
    } catch (error) {
      results.push({ draftId: draft._id, to: contact.email, outcome: "failed", reason: errorText(error) });
    }
  }
  return { sent: results.filter((r) => r.outcome === "sent").length, results };
}
