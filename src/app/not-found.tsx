import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="underline underline-offset-4">Return to Markit</Link>
    </main>
  );
}
