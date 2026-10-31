"use client";

import { EmptyState } from "@/components/markit/app-shell";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="main relative z-[1]">
      <EmptyState title="Something went wrong" text="Try loading the workspace again." action="Try again" onAction={reset} expr="surprised" />
    </main>
  );
}
