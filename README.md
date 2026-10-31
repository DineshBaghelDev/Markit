# Markit

AI-powered market entry, opportunity discovery, lead intelligence, and personalized sales outreach. Built for a three-hour hackathon with YAGNI.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev:all
```

Open http://localhost:3000. This starts Convex first, then Next.js. Stop both with Ctrl+C.

This workspace already has a local Convex deployment configured in ignored `.env.local`. On a fresh clone, run `npx convex dev` once to configure a deployment, then use the command above. Keep the Convex process running when using live queries.

To run them separately, use `npm run dev:convex` and `npm run dev` in two terminals.

## Environment

Use [.env.example](.env.example) as a reference and add only missing values to `.env.local`; do not overwrite existing configuration. Existing credentials in `.env` are preserved.

- `CONVEX_DEPLOYMENT`: deployment selector written by the Convex CLI, not a URL.
- `NEXT_PUBLIC_CONVEX_URL`: public Convex backend URL, also written by the CLI. Existing `CONVEX_URL` is supported as a fallback.
- `LLM_BASE_URL`: OpenAI-compatible LLM server, e.g. `http://127.0.0.1:18080/v1` for local codex-as-api. Leave empty to use Vercel AI Gateway (`AI_GATEWAY_API_KEY`).
- `AI_MODEL`: model ID (`gpt-6.1-sol` for codex-as-api on a ChatGPT account).
- `DEMO_CACHE=on`: record LLM and Crustdata responses in ignored `.demo-cache/` and replay identical requests at no cost.
- `CRUSTDATA_API_KEY`: server-only Crustdata key.

### Demo LLM (codex-as-api)

Run `codex-as-api` in a separate terminal (Python package, uses your Codex/ChatGPT login, listens on port 18080), then start the app.

The app can render without API keys. Credentials are validated when an integration is used. Restart Next.js after changing public environment variables.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Convex and Next.js development |
| `npm run dev` | Next.js only |
| `npm run dev:convex` | Convex functions, generated types, and live backend |
| `npm run check` | Lint, app/backend type checks, and Vitest |
| `npm test` | Run tests once |
| `npm run test:watch` | Watch tests |
| `npm run build` | Production Next.js build |
| `npm start` | Serve the production build |
| `npm run convex:deploy` | Deploy Convex using configured deployment credentials |

## Structure

```text
src/
  app/                 Pages, layout, error/loading states, API routes
    api/               strategy, discover, contacts, enrich, outreach, health routes
    project/[id]/      Pipeline screen for one project
  components/
    providers/         Convex client provider
    ui/                shadcn components
  lib/
    server/            LLM prompts (ai.ts), Crustdata client, demo cache, route helper
    schemas.ts         Zod schemas for input, profile, ICP, qualification, drafts
    crustdata-filters.ts, scoring.ts  ICP-to-filter mapping and rubric scoring (tested)
    env.ts             Environment validation
convex/
  _generated/          CLI-generated API and database types (committed)
  schema.ts            projects, companies, contacts, drafts
  *.ts                 Queries and mutations per table
  health.ts            Read-only backend health query
public/                Static assets
context/               Product brief and handoff context
docs/                  Setup, decisions, and progress
audit/                 Verification evidence and limitations
```

## Current scope

Pipeline: business input → profile + ICP + insights → edit/approve ICP → Crustdata discovery + qualification (0–100) → decision-makers → outreach drafts → approve → CSV export. The UI is deliberately plain. Sending, reply handling and email enrichment are not implemented.

See [setup notes](docs/setup.md), [decisions](docs/decisions.md), [progress](docs/progress.md), [audit](audit/README.md), and [agent instructions](AGENTS.md).
