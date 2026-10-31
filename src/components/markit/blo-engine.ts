// Canvas engine for Blo (the halftone mascot), the moving dot background and the Blo cursor.
// Ported from the designer's prototype (context/Markit · your market copilot.html). Browser-only.

export type BloExpr =
  | "default" | "happy" | "proud" | "excited" | "wink" | "surprised" | "focused" | "thinking";
export type BloTone = "app" | "night" | "mark";
export type BloOptions = { tone: BloTone; particles: boolean; expr: BloExpr; grid: number; wide: number; noHop: boolean };

type Dot = { x: number; y: number; s: number; ph: number };
type Particle = { x: number; y: number; s: number; o: number; v: number; ph: number; star?: boolean };

const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNight = () => document.documentElement.dataset.view === "home";
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const pointer = { x: 0, y: 0, moved: false };
const ripples: { x: number; y: number; t0: number }[] = [];

function bgOf(el: Element | null): string {
  while (el) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
    el = el.parentElement;
  }
  return getComputedStyle(document.documentElement).backgroundColor;
}

export class Blo {
  static all: Blo[] = [];
  static REACT: BloExpr[] = ["excited", "wink", "surprised", "proud"];

  c: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  o: BloOptions;
  expr: BloExpr;
  kick = 0;
  hover = false;
  private react = 0;
  private restExpr: BloExpr | null = null;
  private blinkAt: number;
  private last: number;
  private nextHop = 0;
  private W = 0; private H = 0; private dpr = 1; private S = 0; private ox = 0; private oy = 0;
  private dots: Dot[] | null = null;
  private parts: Particle[] = [];
  private tf = { cx: 0, cy: 0, bob: 0, sx: 1, sy: 1 };
  private observer: ResizeObserver;
  private cleanup: () => void;

  constructor(canvas: HTMLCanvasElement, opt: Partial<BloOptions> = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d")!;
    // Undefined props must not override the defaults.
    const given = Object.fromEntries(Object.entries(opt).filter(([, v]) => v !== undefined)) as Partial<BloOptions>;
    this.o = { tone: "app", particles: false, expr: "default", grid: 34, wide: 1, noHop: false, ...given };
    this.expr = this.o.expr;
    this.blinkAt = performance.now() + 2000 + Math.random() * 3000;
    this.last = performance.now();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();

    const enter = () => {
      this.hover = true; this.kick = Math.max(this.kick, 0.9);
      if (this.expr === "thinking") return;
      this.restExpr = this.expr; this.set(Blo.REACT[this.react++ % Blo.REACT.length]);
    };
    const leave = () => {
      this.hover = false;
      if (this.restExpr && this.expr !== "thinking") this.set(this.restExpr);
      this.restExpr = null;
    };
    const down = () => {
      this.kick = 1; if (this.expr === "thinking") return;
      if (!this.restExpr) this.restExpr = this.expr;
      this.set(Blo.REACT[this.react++ % Blo.REACT.length]);
    };
    canvas.addEventListener("pointerenter", enter);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerdown", down);
    this.cleanup = () => {
      canvas.removeEventListener("pointerenter", enter);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", down);
    };
    Blo.all.push(this);
    startLoop();
  }

  destroy() {
    this.observer.disconnect();
    this.cleanup();
    Blo.all = Blo.all.filter((b) => b !== this);
  }

  resize() {
    const r = this.c.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.S = Math.min(this.H / 0.92, this.W / this.o.wide); this.ox = (this.W - this.S) / 2; this.oy = (this.H - this.S * 0.9) / 2;
    this.build(); this.draw(performance.now());
  }

  private colors() {
    const ground = bgOf(this.c.parentElement);
    const dot = this.o.tone === "night" ? "#C6F24E" : this.o.tone === "mark" ? cssVar("--accent-mark") : cssVar("--text");
    return { ground, dot };
  }

  private build() {
    const n = this.o.grid, S = this.S, step = S / n; this.dots = [];
    const e = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n, y = (j + 0.5) / n; if (y > 0.86) continue;
      const v = Math.min(e(x, y, 0.5, 0.52, 0.47, 0.33), e(x, y, 0.4, 0.33, 0.27, 0.24), e(x, y, 0.64, 0.38, 0.24, 0.21));
      if (v > 1 || y >= 0.8) continue;
      const lx = x - 0.32, ly = y - 0.25, light = 1 - Math.min(1, Math.hypot(lx, ly) / 0.75), core = 1 - v;
      const k = Math.min(1, 0.3 + 0.4 * light + 0.45 * core);
      this.dots.push({ x: this.ox + x * S, y: this.oy + y * S, s: step * 0.96 * k, ph: (x + y) * 6 });
    }
    this.parts = [];
    if (this.o.particles) {
      let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const count = Math.round(260 * this.o.wide);
      for (let p = 0; p < count; p++) {
        const band = rnd();
        this.parts.push({ x: rnd() * this.W, y: this.oy + S * (0.74 + band * 0.16) + Math.sin(rnd() * 6) * S * 0.03, s: step * (0.12 + rnd() * 0.38), o: 0.15 + rnd() * 0.6, v: (rnd() - 0.3) * 6, ph: rnd() * 6 });
      }
      for (let p = 0; p < 40; p++) this.parts.push({ x: rnd() * this.W, y: rnd() * this.H * 0.7, s: step * (0.08 + rnd() * 0.15), o: 0.1 + rnd() * 0.35, v: (rnd() - 0.5) * 2, ph: rnd() * 6, star: true });
    }
  }

  set(expr: BloExpr) {
    if (expr !== this.expr) this.kick = 1;
    this.expr = expr;
    if (reduce()) this.draw(performance.now());
  }

  draw(t: number) {
    const { ctx } = this; if (!this.dots) return;
    const rm = reduce();
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const { ground, dot } = this.colors();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = dot;
    const breathe = rm ? 0 : 0.07;
    this.kick = (this.kick || 0) * Math.pow(0.05, dt);
    if (this.hover && !rm) this.kick = Math.max(this.kick, 0.3);
    if (!rm && !this.o.noHop) {
      if (!this.nextHop) this.nextHop = t + 2000 + Math.random() * 3000;
      if (t > this.nextHop) { this.kick = Math.max(this.kick, 0.75); this.nextHop = t + 4500 + Math.random() * 4000; }
    }
    const amp = rm ? 0 : 1 + this.kick * 3;
    const cx = this.ox + this.S * 0.5, cy = this.oy + this.S * 0.5, ph = t / 1000;
    const hop = rm ? 0 : -Math.abs(Math.sin(t / 170)) * this.kick * this.S * 0.07;
    const bob = rm ? 0 : Math.sin(ph * 1.6) * this.S * 0.035 + hop;
    const sq = rm ? 0 : Math.sin(ph * 3.2) * 0.035 + Math.sin(t / 85) * 0.06 * this.kick;
    const sx = 1 + sq, sy = 1 - sq;
    this.tf = { cx, cy, bob, sx, sy };
    ctx.beginPath();
    for (const d of this.dots) {
      const rx = d.x - cx, ry = d.y - cy, a = Math.atan2(ry, rx);
      const w = 1 + (rm ? 0 : (0.03 * Math.sin(3 * a + ph * 2.4) + 0.022 * Math.sin(5 * a - ph * 3.1)) * amp);
      const x = cx + rx * sx * w, y = cy + ry * sy * w + bob;
      const s = (d.s * (1 + breathe * Math.sin(ph * 1.8 + d.ph))) / 2;
      ctx.moveTo(x + s, y); ctx.arc(x, y, s, 0, Math.PI * 2);
    }
    ctx.fill();
    for (const p of this.parts) {
      if (!rm) { p.x += p.v * dt; if (p.x > this.W + 4) p.x = -4; if (p.x < -4) p.x = this.W + 4; }
      ctx.globalAlpha = p.o * (p.star ? 0.6 + 0.4 * Math.sin(t / 900 + p.ph) : 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.face(t, ground, dot, rm);
  }

  private face(t: number, ground: string, dot: string, rm: boolean) {
    const { ctx } = this, u = this.S / 100, tf = this.tf;
    ctx.save();
    ctx.translate(tf.cx, tf.cy + tf.bob); ctx.scale(tf.sx, tf.sy); ctx.translate(-tf.cx, -tf.cy);
    ctx.translate(this.ox, this.oy); ctx.scale(u, u);
    const r = this.c.getBoundingClientRect();
    let dx = 0, dy = 0;
    if (!rm) {
      dx = Math.max(-1, Math.min(1, (pointer.x - (r.left + r.width / 2)) / 500)) * 1.6;
      dy = Math.max(-1, Math.min(1, (pointer.y - (r.top + r.height / 2)) / 500)) * 1.1;
    }
    let blink = 1;
    if (!rm) {
      const since = t - this.blinkAt;
      if (since > 0 && since < 140) blink = (Math.abs(since - 70) / 70) * 0.9 + 0.1;
      if (since >= 140) this.blinkAt = t + 3500 + Math.random() * 2500;
    }
    ctx.fillStyle = ground; ctx.strokeStyle = ground; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const ell = (cx: number, cy: number, rx: number, ry: number) => {
      ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, rx, Math.max(0.4, ry * blink), 0, 0, Math.PI * 2); ctx.fill();
    };
    const path = (d: string, w: number, fill = false) => {
      ctx.save(); ctx.translate(dx * 0.6, dy * 0.6); const p = new Path2D(d);
      if (fill) ctx.fill(p); else { ctx.lineWidth = w; ctx.stroke(p); }
      ctx.restore();
    };
    const marks = () => { ctx.save(); ctx.strokeStyle = dot; ctx.lineWidth = 2.6; ctx.stroke(new Path2D("M86 12 L90 5 M89 19 L96 15")); ctx.restore(); };
    const e = this.expr;
    if (e === "happy") { path("M42.5 47 Q46 42.5 49.5 47", 2.6); path("M60.5 45 Q64 40.5 67.5 45", 2.6); path("M50 54 Q55 59.5 60 54", 2.8); marks(); }
    else if (e === "proud") { path("M42.5 46 Q46 49.5 49.5 46", 2.6); path("M60.5 44 Q64 47.5 67.5 44", 2.6); path("M50 54 Q55 59 60 54", 2.8); marks(); }
    else if (e === "excited") { ell(46, 45, 3.6, 5.2); ell(64, 43, 3.6, 5.4); path("M49.5 53 Q55 62 60.5 53 Z", 1.5, true); marks(); }
    else if (e === "wink") { path("M42.5 46.5 Q46 43 49.5 46.5", 2.6); ell(64, 44, 3.2, 4.8); path("M50 53.5 Q55 59.5 60 53.5", 2.8); marks(); }
    else if (e === "surprised") { ell(46, 44, 3.9, 4.2); ell(64, 42, 3.9, 4.3); path("M52.6 56.5 a2.4 2.9 0 1 0 4.8 0 a2.4 2.9 0 1 0 -4.8 0", 1, true); marks(); }
    else if (e === "focused") { path("M43 42.5 L48.5 46 L43 49.5", 2.6); path("M67 40.5 L61.5 44 L67 47.5", 2.6); path("M51.5 54 Q55 57 58.5 54", 2.6); }
    else if (e === "thinking") {
      ell(47, 43, 2.8, 4); ell(65, 41, 2.8, 4.2); path("M52 55.5 L57.5 55.5", 2.6);
      ctx.fillStyle = dot;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = rm ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(t / 220 - i * 0.9));
        ctx.beginPath(); ctx.arc(44 + i * 8, 6, 1.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    else { ell(46, 46, 3.2, 4.6); ell(64, 44, 3.2, 4.8); path("M50.5 54 Q55 58.5 59.5 54", 2.8); }
    ctx.restore();
  }
}

/* ---------- Agent status: shared by the header mini Blo and the cursor ---------- */
type AgentState = { expr: BloExpr; text: string; running: boolean };
let agentState: AgentState = { expr: "default", text: "Ready", running: false };
const agentListeners = new Set<() => void>();
export const agentStore = {
  get: () => agentState,
  subscribe: (fn: () => void) => { agentListeners.add(fn); return () => { agentListeners.delete(fn); }; },
  set(patch: Partial<AgentState>) { agentState = { ...agentState, ...patch }; agentListeners.forEach((fn) => fn()); },
};

/* ---------- Moving dot background ---------- */
const bg = {
  c: null as HTMLCanvasElement | null, ctx: null as CanvasRenderingContext2D | null,
  W: 0, H: 0, dpr: 1, px: -999, py: -999,
  attach(canvas: HTMLCanvasElement | null) { this.c = canvas; this.ctx = canvas?.getContext("2d") ?? null; this.resize(); },
  resize() {
    if (!this.c) return;
    const dpr = Math.min(2, devicePixelRatio || 1); this.dpr = dpr; this.W = innerWidth; this.H = innerHeight;
    this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
  },
  draw(t: number) {
    const ctx = this.ctx; if (!ctx) return;
    const rm = reduce(), night = isNight();
    const base = night ? "#34342F" : cssVar("--bg-grain");
    const hot = night ? "#55554F" : cssVar("--text-quiet");
    const gap = night ? 18 : 22;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
    const T = rm ? 0 : t / 1000;
    const offX = (T * 8) % gap, offY = (T * 4) % gap;
    if (pointer.moved) {
      this.px = this.px < -500 ? pointer.x : this.px + (pointer.x - this.px) * 0.12;
      this.py = this.py < -500 ? pointer.y : this.py + (pointer.y - this.py) * 0.12;
    } else { this.px = -999; this.py = -999; }
    while (ripples.length && t - ripples[0].t0 > 1400) ripples.shift();
    const R = 180, hotDots: number[] = [];
    ctx.fillStyle = base; ctx.beginPath();
    for (let y = -gap + offY; y < this.H + gap; y += gap) {
      for (let x = -gap + offX; x < this.W + gap; x += gap) {
        const wave = Math.sin(x * 0.009 + T * 1.4) * Math.cos(y * 0.011 - T * 1.1) + Math.sin((x + y) * 0.005 - T * 0.9) * 0.7;
        let r = 1.1 + wave * 0.8, X = x, Y = y, heat = 0;
        if (!rm) {
          const dx = x - this.px, dy = y - this.py, d = Math.hypot(dx, dy);
          if (d < R) { const f = 1 - d / R; r += f * f * 3; X += (dx / (d || 1)) * f * 12; Y += (dy / (d || 1)) * f * 12; heat = f; }
          for (const rp of ripples) {
            const age = t - rp.t0, rr = age * 0.55, dd = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rr);
            if (dd < 34) { const k = (1 - dd / 34) * (1 - age / 1400); r += k * 3; heat = Math.max(heat, k); }
          }
        }
        if (heat > 0.3) { hotDots.push(X, Y, r); continue; }
        if (r < 0.3) continue;
        ctx.moveTo(X + r, Y); ctx.arc(X, Y, r, 0, 6.2832);
      }
    }
    ctx.fill();
    if (hotDots.length) {
      ctx.fillStyle = hot; ctx.globalAlpha = night ? 0.9 : 0.75; ctx.beginPath();
      for (let i = 0; i < hotDots.length; i += 3) { ctx.moveTo(hotDots[i] + hotDots[i + 2], hotDots[i + 1]); ctx.arc(hotDots[i], hotDots[i + 1], hotDots[i + 2], 0, 6.2832); }
      ctx.fill(); ctx.globalAlpha = 1;
    }
  },
};
export const attachBackground = (canvas: HTMLCanvasElement | null) => { bg.attach(canvas); startLoop(); };

/* ---------- Blo cursor (fine pointers only) ---------- */
let cursor: { blo: Blo; wrap: HTMLElement; tip: HTMLElement; x: number; y: number; vx: number; vy: number; hoverExpr: BloExpr } | null = null;

export function attachCursor(wrap: HTMLElement, canvas: HTMLCanvasElement, tip: HTMLElement) {
  if (!matchMedia("(pointer: fine)").matches) return () => {};
  const html = document.documentElement;
  html.classList.add("blo-cursor");
  const blo = new Blo(canvas, { tone: "night", grid: 16, noHop: true });
  cursor = { blo, wrap, tip, x: pointer.x, y: pointer.y, vx: 0, vy: 0, hoverExpr: "default" };
  const over = (e: PointerEvent) => {
    const t = e.target as Element | null; if (!t?.closest || !cursor) return;
    const typing = t.closest('input:not([type="checkbox"]):not([type="range"]), textarea, select, [contenteditable="true"]');
    html.classList.toggle("cur-text", !!typing);
    cursor.hoverExpr = t.closest("a, button, select, input[type='checkbox'], input[type='range'], tr[data-id], canvas") ? "happy" : "default";
    if (!agentState.running) blo.set(cursor.hoverExpr);
  };
  const down = () => { blo.kick = 1; if (!agentState.running) blo.set("excited"); };
  const up = () => { if (!agentState.running && cursor) blo.set(cursor.hoverExpr); };
  addEventListener("pointerover", over); addEventListener("pointerdown", down); addEventListener("pointerup", up);
  return () => {
    removeEventListener("pointerover", over); removeEventListener("pointerdown", down); removeEventListener("pointerup", up);
    html.classList.remove("blo-cursor", "cur-text");
    blo.destroy(); cursor = null;
  };
}

function drawCursor() {
  if (!cursor) return;
  const c = cursor, rm = reduce();
  c.blo.o.tone = isNight() ? "night" : "mark";
  if (agentState.running && c.blo.expr !== "thinking") c.blo.set("thinking");
  else if (!agentState.running && c.blo.expr === "thinking") c.blo.set(c.hoverExpr);
  const tx = pointer.x + 12, ty = pointer.y + 14;
  if (rm) { c.x = tx; c.y = ty; }
  else { c.vx += (tx - c.x) * 0.2; c.vy += (ty - c.y) * 0.2; c.vx *= 0.6; c.vy *= 0.6; c.x += c.vx; c.y += c.vy; }
  const tilt = rm ? 0 : Math.max(-20, Math.min(20, c.vx * 1.4));
  c.wrap.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${tilt}deg)`;
  c.tip.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
  c.wrap.style.opacity = c.tip.style.opacity = pointer.moved ? "1" : "0";
}

/* ---------- Single animation loop ---------- */
let started = false;
function frame(t: number) {
  bg.draw(t);
  drawCursor();
  for (const b of Blo.all) if (b.c.isConnected && b.c.offsetParent !== null && b !== cursor?.blo) b.draw(t);
  if (cursor) cursor.blo.draw(t);
  requestAnimationFrame(frame);
}
function startLoop() {
  if (started || typeof window === "undefined") return;
  started = true;
  pointer.x = innerWidth / 2; pointer.y = innerHeight / 2;
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; });
  document.documentElement.addEventListener("pointerleave", () => { pointer.moved = false; });
  addEventListener("pointerdown", (e) => { ripples.push({ x: e.clientX, y: e.clientY, t0: performance.now() }); if (ripples.length > 4) ripples.shift(); });
  addEventListener("resize", () => bg.resize());
  requestAnimationFrame(frame);
}
