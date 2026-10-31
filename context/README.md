# Project context

## Brief

Markit automates market entry, opportunity discovery, lead intelligence, and personalized sales outreach.

## Constraints

- Three-hour hackathon: ship a focused demo and apply YAGNI.
- Prefer existing libraries, SDKs, and components.
- Stack: Next.js + TypeScript, Tailwind CSS + shadcn/ui, OpenAI SDK, Convex, Vercel, Crustdata API, Zod, Vitest.
- Keep the project clean and structured, maintain documentation, and commit coherent milestones using the user's Git identity.

## Initial direction and open details

Suggested demo flow: target market -> opportunities -> relevant companies/leads -> personalized outreach drafts.

Exact screens, search criteria, scoring, API access, and demo dataset are not yet defined. This flow is a starting assumption, not a completed product specification.

## Current handoff

The application foundation is installed at the repository root. Local Convex is configured and its health query returned ok; the supplied cloud project rejected the current account. OpenAI and Crustdata server clients are present; AI requests still need an OpenAI key and model. Start both services with npm run dev:all. See [setup](../docs/setup.md), [progress](../docs/progress.md), and [decisions](../docs/decisions.md).
