import Link from "next/link";
import { BloCanvas } from "@/components/markit/blo";

const COLUMNS = [
  ["01 Understand", ["Business profile", "Value proposition", "Sales objective"]],
  ["02 Target", ["Ideal customer profile", "Buying signals", "Market context"]],
  ["03 Qualify", ["Company discovery", "Fit scores with evidence", "Decision-makers"]],
  ["04 Reach", ["Personalised emails", "Review and approve", "Export to CSV"]],
] as const;

export default function Landing() {
  return (
    <section aria-label="Markit home">
      {/* Switch to night mode before first paint; the Fx component keeps it in sync on navigation. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.dataset.view='home'" }} />
      <div className="night">
        <header className="n-wrap n-head">
          <Link className="logo" href="/">markit<i>.</i></Link>
          <nav className="n-nav" aria-label="Site">
            <a href="#how">How it works</a>
            <Link href="/new">Try the agent</Link>
            <a href="#how">Built on Crustdata</a>
          </nav>
          <Link className="btn-n light" href="/new">Start selling ↗</Link>
        </header>

        <div className="hero">
          <div className="live"><b />Your market copilot</div>
          <h1><span>Know who’s</span> ready to buy.</h1>
          <p>
            Tell Markit what you sell and where. It finds the companies with a reason to buy, the people who
            decide, and writes the first email, with the evidence behind every claim.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link className="btn-n lime" href="/new">Try it on your product ↗</Link>
            <a className="btn-n ghost" href="#how">See how it works</a>
          </div>
          <div className="hero-blo">
            <BloCanvas tone="night" particles grid={36} expr="happy" wide={1.8} label="Blo, the Markit mascot, made of glowing dots" />
          </div>
        </div>

        <div className="n-wrap" id="how">
          <div className="statement">
            <div className="dots" aria-label="Find. Qualify. Reach.">FIND. QUALIFY. REACH.</div>
            <p className="m-0 max-w-[360px] text-sm leading-relaxed text-[var(--ash)]">
              Built on Crustdata’s live company and people graph, so every prospect comes with the evidence behind it.
            </p>
          </div>
          <div className="n-cols">
            {COLUMNS.map(([heading, links]) => (
              <div key={heading}>
                <div className="label pb-3">{heading}</div>
                {links.map((l) => <Link key={l} href="/new">{l}</Link>)}
              </div>
            ))}
          </div>
          <div className="n-foot label"><span>© 2026 Markit</span><span>ContextCon, IIT Bombay</span></div>
        </div>
      </div>
    </section>
  );
}
