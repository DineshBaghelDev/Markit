"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">Please try loading the workspace again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
