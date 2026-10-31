# Decision tracker

| Date | Decision | Rationale and consequence |
| --- | --- | --- |
| 2026-10-31 | Optimize for a three-hour hackathon MVP and apply YAGNI. | Prioritize a working demo; defer features and abstractions without an immediate need. |
| 2026-10-31 | Use the user-selected stack and reuse libraries/components. | Next.js, TypeScript, Tailwind CSS, shadcn/ui, OpenAI SDK, Convex, Vercel, Crustdata API, Zod, and Vitest. Exact versions will be selected during scaffolding. |
| 2026-10-31 | Maintain context/, audit/, docs/, and synchronized AGENTS.md / CLAUDE.md. | Preserve product intent, implementation decisions, progress, and verification across sessions with minimal process. |
| 2026-10-31 | Make regular meaningful commits using the configured user identity, without assistant attribution. | Keep milestones reviewable and follow the user's authorship requirement. |
| 2026-10-31 | Keep the Next.js application at the repository root, with source in src/ and Convex functions in convex/. | Follow the user's folder preference and standard framework conventions. |
| 2026-10-31 | Use local Convex during initial development. | The supplied cloud project rejected the machine's current account; local schema deployment and health query succeeded. Preserve the original cloud configuration in .env. |
| 2026-10-31 | Use Convex CLI's --start option to run both services. | Avoid an extra process-runner dependency. |
| 2026-10-31 | Initialize shadcn with its current Base UI Nova preset and use Node 22.12+ with compatible Node types. | Reuse maintained components and satisfy current Vitest peer dependencies without overrides. |
| 2026-10-31 | Use Vercel AI SDK structured output; LLM via local codex-as-api (OpenAI-compatible) when LLM_BASE_URL is set, else Vercel AI Gateway. | Avoids paid API keys during the hackathon. codex-as-api does not enforce response_format, so the JSON Schema is embedded in the prompt and invalid output gets one corrective retry. Replaced the OpenAI SDK. |
| 2026-10-31 | Store all pipeline state in Convex (projects, companies, contacts, drafts). | Results persist across refreshes and are reused for the demo instead of regenerating. Functions are public without auth (hackathon scope). |
| 2026-10-31 | Record/replay cache for LLM and Crustdata calls in .demo-cache (DEMO_CACHE=on), gitignored. | Identical requests replay at no cost; replayed companies/contacts are labelled "cached replay". The cache holds real lead data, so the demo runs locally and is not deployed to Vercel. |
| 2026-10-31 | Map ICP industries/countries to Crustdata values via autocomplete; filter people by decision-maker seniority; LLM picks up to 3 per company. | Prevents invalid filters and irrelevant contacts at large companies. |
| 2026-10-31 | Qualification rubric: fit 40, use case 30, signals 20, geography 10; code clamps scores and drops evidence not present in the record. | Keeps scores explainable and grounded. |
| 2026-10-31 | No email enrichment in the UI. | The Crustdata key returns 403 for /person/contact/enrich; contacts use LinkedIn profile URLs and emails show as not available. |
| 2026-10-31 | Adopt the designer's prototype (context/Markit · your market copilot.html) as the design system. | Tokens and component classes live in src/app/globals.css (shadcn tokens mapped onto them); Blo mascot, dot field and Blo cursor are ported to canvas in src/components/markit/blo-engine.ts. Routes: / night landing, /new step 01, /project/[id]#profile|strategy|prospects|outreach. Prototype-only claims (contenteditable profile, segment toggles, web-search intel) were not reproduced because the backend does not support them; market context is labelled as unsourced model knowledge. |
