"use client";

import { useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { publicEnvSchema } from "@/lib/env";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const { NEXT_PUBLIC_CONVEX_URL: url } = publicEnvSchema.parse({
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    });
    return url ? new ConvexReactClient(url) : null;
  });

  if (!client) return children;

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
