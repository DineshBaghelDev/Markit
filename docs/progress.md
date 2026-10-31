# Progress tracker

Updated: 2026-10-31

## Completed

- Project rules, documentation trackers, and the Next.js + Convex + shadcn foundation.
- Core pipeline (API routes in src/app/api, state in Convex): business profile + ICP + market insights; ICP edit/approve; Crustdata company discovery with autocomplete-resolved filters, deduplication and rubric qualification; decision-maker discovery; personalised outreach drafts with edit, regenerate, approve, copy and CSV export.
- LLM via local codex-as-api (gpt-6.1-sol) with prompt-embedded schema and corrective retry; record/replay demo cache.
- Recorded scenarios: VoltGrid Storage (UAE BESS: 30 companies, 7 contacts, 4 drafts) and AuditPilot (UK compliance SaaS: 13 companies, 6 contacts, 2 drafts).
- UI rebuilt on the updated prototype: sidebar stepper with five steps (Business, Strategy, Prospects, Outreach, Campaign), document upload, autopilot mode, evidence drawer, decision-maker cards, three-column email review, Campaign step with Gmail sending (allowlist only) or a labelled simulated send when Gmail is not configured.
- Guided example replays a completed template project from Convex, so it also works on Vercel.
- Hackathon submission made. Post-submission audit fixed honesty labels (example runs and simulated sends) and stale documentation.

## Active

- None.

## Deferred

- Authentication; reply classification, follow-ups, booked calls and analytics; working email enrichment (403 on current Crustdata plan).

## Known limitations

- No auth: Convex functions and API routes are public.
- Live discovery takes about 4 minutes, now in the background with progressive scoring. A single stage that exceeds 300 s on Vercel is flagged as stopped after 6 minutes rather than finishing.
- The daily send cap is per project, not per sender.
- The strategy model sometimes leaves company size empty; set it in the ICP editor before approval.

## Next action

Add authentication and per-user project ownership before any use beyond the demo.
