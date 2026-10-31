import "server-only";

import OpenAI from "openai";
import { requireServerEnv } from "@/lib/env";

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  client ??= new OpenAI({
    apiKey: requireServerEnv("OPENAI_API_KEY"),
    timeout: 30_000,
    maxRetries: 1,
  });
  return client;
}
