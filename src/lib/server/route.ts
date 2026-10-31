import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

// Wrap a JSON route: validate the body, run the handler and return useful errors.
export function jsonRoute<T>(schema: z.ZodType<T>, handler: (body: T) => Promise<unknown>) {
  return async (request: Request) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    try {
      return NextResponse.json((await handler(parsed.data)) ?? { ok: true });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
