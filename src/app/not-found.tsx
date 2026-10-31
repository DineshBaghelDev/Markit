"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/markit/app-shell";

export default function NotFound() {
  const router = useRouter();
  return (
    <main className="main relative z-[1]">
      <EmptyState title="Page not found" text="That page doesn’t exist." action="Return to Markit" onAction={() => router.push("/")} expr="surprised" />
    </main>
  );
}
