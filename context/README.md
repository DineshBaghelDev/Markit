# Project context

## Brief

Markit automates market entry, opportunity discovery, lead intelligence, and personalized sales outreach.

## Constraints

- Three-hour hackathon: ship a focused demo and apply YAGNI.
- Prefer existing libraries, SDKs, and components.
- Stack: Next.js + TypeScript, Tailwind CSS + shadcn/ui, Vercel AI SDK (codex-as-api locally / AI Gateway), Convex, Vercel, Crustdata API, Zod, Vitest.
- Keep the project clean and structured, maintain documentation, and commit coherent milestones using the user's Git identity.

## Initial direction and open details

Suggested demo flow: target market -> opportunities -> relevant companies/leads -> personalized outreach drafts.

Exact screens, search criteria, scoring, API access, and demo dataset are not yet defined. This flow is a starting assumption, not a completed product specification.

## Current handoff

The core pipeline is implemented and recorded for the UAE battery-storage scenario; the B2B SaaS scenario (AuditPilot, UK) is being recorded. Run codex-as-api, then `npm run dev` with `DEMO_CACHE=on`; open projects from the home page. See [setup](../docs/setup.md), [progress](../docs/progress.md), and [decisions](../docs/decisions.md).
