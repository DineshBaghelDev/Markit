import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Record/replay cache for paid calls (LLM and Crustdata). Identical requests are answered from disk,
// so a recorded demo run can be replayed without spending credits or tokens. Enabled with DEMO_CACHE=on.
const CACHE_DIR = path.join(process.cwd(), ".demo-cache");

export const demoCacheEnabled = () => process.env.DEMO_CACHE === "on";

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
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ key, value, recordedAt: new Date().toISOString() }, null, 2));
    return { value, cached: false };
  }
}
