import "server-only";

import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { businessInputSchema, type ParsedBusinessInput } from "@/lib/schemas";
import { paceDemoStep } from "@/lib/server/demo-cache";
import { readSellerDocuments } from "@/lib/server/documents";

const errorResponse = (error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
};

type Bucket = "pipeline" | "send";

// The caller's IP (Vercel sets x-forwarded-for; the first entry is the client).
const clientKey = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";

// Returns a 429 response when the caller is over its limit, otherwise null. Limits live in Convex (convex/rateLimits.ts).
// If the limiter itself is unavailable (e.g. Convex functions not yet deployed) the request is allowed and logged.
async function rateLimited(request: Request, bucket: Bucket) {
  try {
    const { ok, retryAfter } = await fetchMutation(api.rateLimits.consume, { bucket, key: clientKey(request) });
    if (ok) return null;
    const seconds = Math.max(1, Math.ceil(retryAfter / 1000));
    return NextResponse.json(
      { error: `Too many requests. Try again in ${seconds < 90 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`}.` },
      { status: 429, headers: { "Retry-After": String(seconds) } },
    );
  } catch (error) {
    console.warn("[rate-limit] check failed, allowing request:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Wrap a JSON route: rate-limit, validate the body, run the handler and return useful errors.
export function jsonRoute<T>(schema: z.ZodType<T>, handler: (body: T) => Promise<unknown>, bucket: Bucket | null = "pipeline") {
  return async (request: Request) => {
    const limited = bucket && await rateLimited(request, bucket);
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    const startedAt = Date.now();
    try {
      const result = await handler(parsed.data);
      await paceDemoStep(startedAt);
      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

// Business input arrives as JSON or as multipart form data with optional "documents" files.
export function businessInputRoute(handler: (input: ParsedBusinessInput, warnings: string[]) => Promise<unknown>) {
  return async (request: Request) => {
    const limited = await rateLimited(request, "pipeline");
    if (limited) return limited;
    let raw: unknown;
    let warnings: string[] = [];
    try {
      if (request.headers.get("content-type")?.includes("multipart/form-data")) {
        const form = await request.formData();
        const files = form.getAll("documents").filter((f): f is File => f instanceof File);
        const read = await readSellerDocuments(files);
        warnings = read.warnings;
        const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
        raw = { ...fields, documents: read.documents };
      } else {
        raw = await request.json().catch(() => null);
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid upload" }, { status: 400 });
    }

    const parsed = businessInputSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    try {
      const startedAt = Date.now();
      const result = await handler(parsed.data, warnings);
      await paceDemoStep(startedAt);
      return NextResponse.json({ ...(result as object), warnings });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
