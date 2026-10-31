import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { businessInputSchema, type ParsedBusinessInput } from "@/lib/schemas";
import { paceDemoStep } from "@/lib/server/demo-cache";
import { readSellerDocuments } from "@/lib/server/documents";

const errorResponse = (error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
};

// Wrap a JSON route: validate the body, run the handler and return useful errors.
export function jsonRoute<T>(schema: z.ZodType<T>, handler: (body: T) => Promise<unknown>) {
  return async (request: Request) => {
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
