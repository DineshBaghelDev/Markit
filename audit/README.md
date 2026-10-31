# Audit and verification log

Record checks actually performed, findings, and limitations here. Keep entries dated and concise.

## 2026-10-31 — Repository conventions

- Initial inspection: repository contained README.md and Git metadata; working tree was clean.
- Git identity: a user author name and email were configured.
- Scope: agent instructions and project documentation only; application scaffolding is pending.
- Verified that all eight documentation files exist and AGENTS.md and CLAUDE.md match exactly.
- Passed git diff --check and git diff --cached --check; verified local Markdown links resolve.
- Confirmed .env is ignored by Git and only the nine intended setup files are staged.
- Added environment file ignore rules after an untracked .env appeared; its contents were not read or staged.
- Application tests/build: not applicable yet; no app or test configuration exists.

## 2026-10-31 — Application foundation

- Installed Next.js 16.4.3, React 19.3, Tailwind 4, shadcn Base UI components, Convex 1.49, OpenAI SDK, Zod 4, and Vitest 5 with compatible Node 22 type definitions.
- All application files are at the repository root; the temporary generator directory was removed.
- Retrieved current Convex integration/CLI documentation using Context7 and consulted official SDK/framework documentation.
- Supplied cloud deployment access failed under the current identity. Configured a local Convex deployment, deployed the campaign schema and health query, and verified health:check returned status ok.
- Production build passed, including application TypeScript checking and page generation.
- Vitest: two test files passed, eight tests passed, covering campaign input limits/normalization and environment validation.
- No OpenAI or paid Crustdata requests were made. Credentials remain ignored; no secret values were added to documentation.
- npm run check passed: ESLint, Next route generation, application/backend TypeScript checks, and all eight Vitest tests.
- HTTP smoke checks: home page returned 200 and /api/health returned status ok. Browser visual verification was not performed for this minimal starter page.
- Confirmed .env, .env.local, and .convex remain ignored by Git.

## 2026-10-31: Core pipeline

- npm run check passed after each change: ESLint, Next route types, app and Convex TypeScript, 8 Vitest tests (filters, dedupe, scoring, env).
- Convex functions deployed to the cloud dev deployment (aromatic-skunk-858).
- codex-as-api probed: gpt-5.x/gpt-5.4-mini rejected for the ChatGPT account; gpt-6.1-sol and gpt-5.6-luna work; response_format json_schema is not enforced (extra/mis-shaped keys observed).
- Strategy initially failed Zod validation (salesObjective returned as an object). After embedding the JSON Schema in the prompt it passed first try (~44s).
- UAE BESS run via API routes: 3 segments, 30 companies (scores 21-82, evidence filtered to existing fields), 7 decision-makers at 4 selected companies, 4 drafts. Discovery took 3m53s.
- Replay check: identical strategy request returned from .demo-cache in 1.3s with no model call.
- /person/contact/enrich returned HTTP 403 (permission_error) for the current key; no emails were stored or invented.
- Crustdata usage in testing: about 2 + 30 company results, about 2 + 25 person results, plus autocomplete calls (cached).
- Not yet done: browser click-through of the UI; Vercel deployment.
- SaaS run (AuditPilot, UK): ICP edited to 50-1000 employees, then approved; 13 companies after dedupe (scores up to 81), 6 decision-makers at 3 selected companies, 2 drafts. ICP, roles and messaging differed clearly from the BESS run.
- Page smoke check: /, and both /project/[id] pages returned HTTP 200. Interactive browser click-through not performed.
