import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Record/replay cache for paid calls (LLM and Crustdata). Identical requests are answered from disk,
// so a recorded demo run can be replayed without spending credits or tokens. Enabled with DEMO_CACHE=on.
const CACHE_DIR = path.join(process.cwd(), ".demo-cache");

export const demoCacheEnabled = () => process.env.DEMO_CACHE === "on";

// Demo pacing (DEMO_STEP_DELAY=on): a replayed step returns instantly, which hides the progress animation.
// Pads each pipeline request to a random 2.5-3.5 s. Slower (live) requests are never delayed further.
export async function paceDemoStep(startedAt: number) {
  if (process.env.DEMO_STEP_DELAY !== "on") return;
  const wait = 2_500 + Math.random() * 1_000 - (Date.now() - startedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function withDemoCache<T>(
  namespace: string,
  key: unknown,
  fn: () => Promise<T>,
): Promise<{ value: T; cached: boolean }> {
  if (!demoCacheEnabled()) return { value: await fn(), cached: false };

  const hash = createHash("sha256").update(JSON.stringify(key)).digest("hex").slice(0, 24);
  const file = path.join(CACHE_DIR, namespace, `${hash}.json`);
  try {
    return { value: JSON.parse(await readFile(file, "utf8")).value as T, cached: true };
  } catch {
    const value = await fn();
    // Recording is best-effort: read-only filesystems (e.g. Vercel) must not fail the request.
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ key, value, recordedAt: new Date().toISOString() }, null, 2));
    } catch (error) {
      console.warn(`[demo-cache] could not record ${namespace}:`, error instanceof Error ? error.message : error);
    }
    return { value, cached: false };
  }
}
