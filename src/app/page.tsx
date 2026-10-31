import Link from "next/link";
import { BloCanvas } from "@/components/markit/blo";

export default function Landing() {
  return (
    <section aria-label="Markit home">
      {/* Switch to night mode before first paint; the Fx component keeps it in sync on navigation. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.view='home'" }} />
      <div className="night">
        <header className="n-wrap n-head">
          <Link className="logo" href="/">markit<i>.</i></Link>
          <nav className="n-nav" aria-label="Site">
            <Link href="/new">How it works</Link>
            <Link href="/new">Try the agent</Link>
            <span className="text-sm text-[var(--ash)]">Built on Crustdata</span>
          </nav>
          <Link className="btn-n light" href="/new">Start selling ↗</Link>
        </header>

        <div className="hero">
          <div className="live"><b />Your market copilot</div>
          <h1><span>Know who’s</span> ready to buy.</h1>
          <p>
            Tell Markit what you sell and where. It finds the companies with a reason to buy, the people who
            decide, and writes the first email, with a source behind every claim.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link className="btn-n lime" href="/new">Try it on your product ↗</Link>
            <Link className="btn-n ghost" href="/new">See how it works</Link>
          </div>
          <div className="hero-blo">
            <BloCanvas tone="night" particles grid={36} expr="happy" wide={1.8} label="Blo, the Markit mascot, made of glowing dots" />
          </div>
        </div>

      </div>
    </section>
  );
}
