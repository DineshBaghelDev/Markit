# Markit

Tell Markit what you sell and where. It builds a business profile and an ideal customer profile (ICP), searches Crustdata for matching companies, scores each one with evidence from its record, picks the decision-makers, and drafts a personalised first email for your approval. Every factual claim in a score or email cites a field in the company's Crustdata record.

Built in a three-hour hackathon, so the scope is deliberately small (see [limitations](#known-limitations)).

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
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_ALLOWLIST`: optional Gmail sending. Mail goes only to allowlisted addresses. Without Gmail, the Campaign step runs in a labelled demo mode that simulates sending.
- `DEMO_STEP_DELAY=on`: pads replayed steps to about 3 s so the progress animation is visible.
- `DEMO_TEMPLATE_PROJECT_ID`: completed project that the "Use example" input replays (works without the local cache, e.g. on Vercel).

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
    api/               strategy, autopilot, discover, contacts, enrich, outreach, send, health routes
    new/               Step 1: business input, documents, guided or autopilot mode
    project/[id]/      Steps 1-5 for one project: Business, Strategy, Prospects, Outreach, Campaign
  components/
    markit/            App shell, step UI primitives, Blo mascot (canvas)
    providers/         Convex client provider
    ui/                shadcn components
  lib/
    server/            Pipeline, LLM prompts (ai.ts), Crustdata client, documents, Gmail, demo cache/replay, route helper
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

1. **Business**: describe the business in free text, optionally with documents (PDF, DOCX, TXT, MD). The model builds a profile you can correct.
2. **Strategy**: an ICP (segments, size, countries, buyer roles, signals, exclusions) and market context. Edit, then approve. Searches use only an approved ICP.
3. **Prospects**: Crustdata company search per segment, deduplication, and LLM qualification on a fixed 0-100 rubric. Evidence that does not exist in the record is removed by code. Select companies, then find decision-makers (Crustdata people search plus an LLM pick of up to 3 per company).
4. **Outreach**: one draft per included contact with cited fields. Edit, regenerate, approve, copy, or export CSV.
5. **Campaign**: send approved emails from Gmail to allowlisted addresses only, with an opt-out line, a daily cap and no duplicate sends.

Autopilot mode runs steps 2-4 unattended and stops at drafts for human approval.

## Known limitations

- No authentication: Convex functions and API routes are public. Anyone with the URL can view, change or delete projects and spend LLM/Crustdata credits. Do not deploy with real customer data.
- Work-email enrichment returns 403 on the current Crustdata plan, so most contacts have no email. Use "Add person manually" (e.g. your own address) to demonstrate sending.
- The daily send cap is counted per project, not per sender.
- Reply tracking, follow-ups and booked calls are not built.
- A live discovery run takes about 4 minutes; Autopilot runs in a background task that can exceed the 300 s function limit on Vercel. The recorded example replays in seconds.

See [setup notes](docs/setup.md), [decisions](docs/decisions.md), [progress](docs/progress.md), [audit](audit/README.md), and [agent instructions](AGENTS.md).
