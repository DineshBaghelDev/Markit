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
