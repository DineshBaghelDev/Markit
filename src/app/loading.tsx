import { EmptyState } from "@/components/markit/app-shell";

export default function Loading() {
  return (
    <main className="main relative z-[1]" role="status">
      <EmptyState title="Loading Markit" text="One moment." expr="thinking" />
    </main>
  );
}
