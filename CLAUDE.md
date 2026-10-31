# Markit agent instructions

## Project and scope

Markit is an AI-powered platform for market entry, opportunity discovery, lead intelligence, and personalized sales outreach. This is a three-hour hackathon project: prioritize a working, demonstrable MVP.

- Stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui and suitable component libraries, OpenAI SDK, Convex, Vercel, Crustdata API, Zod, and Vitest.
- Apply YAGNI. Build only what the current demo needs; avoid speculative features, generic frameworks, unnecessary abstractions, and infrastructure.
- Prefer established libraries, tools, SDKs, and existing components over custom implementations.
- Act as an engineer and problem solver: inspect first, identify the actual problem, make practical decisions, implement, and verify.
- Resolve routine implementation choices autonomously. Ask when missing information materially changes scope or blocks progress.
- Treat the suggested flow (target market -> opportunities -> companies/leads -> personalized outreach drafts) as an initial MVP direction, pending product detail.

## Clean project structure

- Keep one application and organize by responsibility. Use standard framework conventions and add directories only when needed.
- Keep UI, integration code, validation, and business logic understandable and focused; avoid duplicating logic.
- Use descriptive names, remove dead code introduced by your changes, and keep generated files and secrets out of Git.
- Keep API credentials on the server. Provide placeholder environment variable names in an example file when integrations are added.
- Validate external input and AI output with Zod where appropriate. Do not invent company or lead facts; distinguish mock/demo data from live data.

## Persistent context and documentation

Read these files before starting work and update them as relevant work progresses:

- `context/README.md`: product brief, constraints, assumptions, and current handoff context.
- `docs/decisions.md`: dated decisions with rationale and consequences; keep this lightweight.
- `docs/progress.md`: completed, active, planned, and blocked work, plus the next concrete step.
- `audit/README.md`: dated verification evidence, findings, and known limitations. Never claim a check ran when it did not.
- `README.md`: project entry point and setup/run instructions once the app exists.

Update progress at meaningful milestones and before handing off. Record material decisions when made. Keep documentation short, accurate, and consistent with the repository. Do not put secrets or private lead data into these files.

## Implementation and verification

- Deliver small, complete slices of the demo flow.
- Use Vitest for meaningful business logic and validation tests; do not add tests that merely mirror trivial implementation.
- Run the relevant available checks after changes (for example lint, type checking, tests, and build). Verify important UI flows when implemented.
- Record checks actually run and any blockers in `audit/README.md`.
- Prefer simple, explicit error handling and useful loading/empty/error states for the demonstrated flow.
- Report what changed, what was verified, and any remaining limitation.

## Git workflow

- Commit regularly after coherent, verified milestones with meaningful messages that explain the change.
- Inspect the diff and stage only intended files. Preserve unrelated user changes.
- Use the user's configured Git author and committer identity. Do not add the assistant as an author, co-author, sign-off, or attribution trailer.
- Never change Git identity, rewrite history, or include credentials to create a commit.
- If Git identity is missing, report the blocker instead of inventing an identity.

## Current documentation with Context7

Use the `ctx7` CLI whenever a task asks about a library, framework, SDK, API, CLI tool, or cloud service, including syntax, configuration, migrations, setup, and library-specific debugging. Prefer it over web search for library documentation, even for familiar tools.

Do not use it for pure refactoring, scripts from scratch, business logic debugging, code review, or general programming concepts.

1. Resolve first: `npx ctx7@latest library <name> "<specific concept to look up>"`. Use the official name and punctuation.
2. Select the best `/org/project` match using exact name, relevance, snippet count, source reputation, and benchmark score. Try an alternate name/query if results are unsuitable.
3. Fetch: `npx ctx7@latest docs <libraryId> "<specific concept>"`. Use a separate docs command per distinct concept unless the question concerns their interaction.
4. Use fetched documentation to guide the answer or implementation.

- Always run `library` before `docs` unless the user supplies a valid `/org/project` ID.
- For version-specific questions, use the versioned ID returned by resolution.
- Run no more than three Context7 commands per question. Never include sensitive information in queries.
- Run Context7 outside the default sandbox. If DNS/network resolution fails, rerun outside the sandbox rather than retrying inside it.
- If quota is exhausted, tell the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY`. Do not silently substitute training knowledge.

## Instruction consistency

Keep root `AGENTS.md` and `CLAUDE.md` synchronized when project rules change. Use these conventional uppercase filenames so coding agents discover them.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
