"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { postJson } from "@/lib/post-json";

const FIELDS = [
  ["companyName", "Company name"],
  ["website", "Website (optional)"],
  ["product", "What do you sell?"],
  ["valueProposition", "Problem solved / value proposition"],
  ["geography", "Target geography"],
  ["objective", "Sales objective"],
] as const;

export default function Home() {
  const router = useRouter();
  const projects = useQuery(api.projects.list);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = Object.fromEntries(new FormData(event.currentTarget));
      const { projectId } = await postJson<{ projectId: string }>("/api/strategy", input);
      router.push(`/project/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Markit: AI sales agent</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        {FIELDS.map(([name, label]) => (
          <label key={name} className="block">
            <span className="text-sm">{label}</span>
            {name === "product" || name === "valueProposition" ? (
              <textarea name={name} rows={3} className="block w-full border p-2" required={name === "product"} />
            ) : (
              <input name={name} className="block w-full border p-2" required={name === "companyName" || name === "geography"} />
            )}
          </label>
        ))}
        <button disabled={busy} className="border px-4 py-2">
          {busy ? "Generating profile and ICP…" : "Generate strategy"}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>

      <section>
        <h2 className="font-semibold">Projects</h2>
        {projects === undefined ? <p>Loading…</p> : projects.length === 0 ? <p>No projects yet.</p> : (
          <ul className="list-disc pl-5">
            {projects.map((p) => (
              <li key={p._id}>
                <Link className="underline" href={`/project/${p._id}`}>{p.profile?.companyName ?? "Untitled"}</Link>{" "}
                <span className="text-sm text-gray-500">({p.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
