# Progress tracker

Updated: 2026-10-31

## Completed

- Project rules, documentation trackers, and the Next.js + Convex + shadcn foundation.
- Core pipeline (API routes in src/app/api, state in Convex): business profile + ICP + market insights; ICP edit/approve; Crustdata company discovery with autocomplete-resolved filters, deduplication and rubric qualification; decision-maker discovery; personalised outreach drafts with edit, regenerate, approve, copy and CSV export.
- LLM via local codex-as-api (gpt-6.1-sol) with prompt-embedded schema and corrective retry; record/replay demo cache.
- Recorded UAE battery-storage scenario end to end (30 companies, 7 contacts, 4 drafts).
- Plain demo UI: / (form + project list) and /project/[id] (all steps).

## Active

- None. Both demo scenarios are recorded: VoltGrid Storage (UAE BESS: 30 companies, 7 contacts, 4 drafts) and AuditPilot (UK compliance SaaS: 13 companies, 6 contacts, 2 drafts).

## Deferred

- Gmail sending, reply classification, follow-ups, analytics; email enrichment (403 on current Crustdata plan); UI styling; Vercel deployment.

## Known limitations

- Live discovery takes about 4 minutes with codex-as-api (qualification batches appear to run sequentially); replay is near-instant.
- The strategy model often leaves company size empty; set it in the ICP editor before approval.

## Next action

Click through both projects in the browser and rehearse the demo with codex-as-api running and DEMO_CACHE=on.
