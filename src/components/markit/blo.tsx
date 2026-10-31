"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { agentStore, attachBackground, attachCursor, Blo, type BloOptions } from "./blo-engine";

type BloProps = Partial<BloOptions> & { className?: string; label?: string };

// Blo, the halftone mascot. Expression changes are applied to the live instance.
export function BloCanvas({ className, label, expr = "default", ...opt }: BloProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const blo = useRef<Blo | null>(null);
  const { tone, particles, grid, wide, noHop } = opt;

  useEffect(() => {
    const b = new Blo(ref.current!, { tone, particles, grid, wide, noHop, expr });
    blo.current = b;
    return () => b.destroy();
    // Rebuild only when the shape options change; expression is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, particles, grid, wide, noHop]);

  useEffect(() => { blo.current?.set(expr); }, [expr]);

  return <canvas ref={ref} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

// Mini Blo + status text that mirrors whatever the agent is doing.
export function AgentStatus() {
  const agent = useSyncExternalStore(agentStore.subscribe, agentStore.get, agentStore.get);
  return (
    <div className="agent" aria-live="polite">
      <BloCanvas tone="mark" grid={18} expr={agent.expr} />
      <span>{agent.text}</span>
    </div>
  );
}

// Page-wide effects: the moving dot field, the Blo cursor, and night/paper mode by route.
export function Fx() {
  const pathname = usePathname();
  const bgRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.view = pathname === "/" ? "home" : "app";
  }, [pathname]);

  useEffect(() => {
    attachBackground(bgRef.current);
    const detach = attachCursor(wrapRef.current!, curRef.current!, tipRef.current!);
    return () => { detach(); attachBackground(null); };
  }, []);

  return (
    <>
      <canvas id="bgfx" ref={bgRef} aria-hidden="true" />
      <div id="cur" ref={wrapRef} aria-hidden="true" style={{ opacity: 0 }}><canvas ref={curRef} /></div>
      <div id="cur-tip" ref={tipRef} aria-hidden="true" style={{ opacity: 0 }} />
    </>
  );
}
