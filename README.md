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
- `OPENAI_API_KEY`: server-only OpenAI key; still required for AI requests.
- `OPENAI_MODEL`: model available to your account; choose it when implementing the AI workflow.
- `CRUSTDATA_API_KEY`: server-only Crustdata key.

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
    api/health/        Application liveness endpoint
  components/
    providers/         Convex client provider
    ui/                shadcn components
  lib/
    server/            Server-only OpenAI and Crustdata clients
    validations/       Zod schemas and colocated tests
    env.ts             Environment validation
convex/
  _generated/          CLI-generated API and database types (committed)
  schema.ts            Initial campaign table
  health.ts            Read-only backend health query
public/                Static assets
context/               Product brief and handoff context
docs/                  Setup, decisions, and progress
audit/                 Verification evidence and limitations
```

## Current scope

The application foundation is ready: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Convex, OpenAI SDK, Crustdata client, Zod, and Vitest. The starter page is intentionally minimal. Campaign creation, market research, lead search, and outreach generation are the next implementation step.

See [setup notes](docs/setup.md), [decisions](docs/decisions.md), [progress](docs/progress.md), [audit](audit/README.md), and [agent instructions](AGENTS.md).
