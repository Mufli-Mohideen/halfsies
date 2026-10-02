import { useEffect, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { crossingPoints, lineCrosses, lineThrough, rotate, snapLine, type Line, type Vec } from '../game/geometry';
import type { Grade } from '../game/scoring';
import type { Shape } from '../game/shapes';
import { drawShape, lineToScreen, PALETTE, strokeLine, type View } from '../render/draw';
import { prefersReducedMotion } from '../lib/motion';
import { sound, vibrate } from '../lib/sound';

export interface Ghost {
  line: Line;
  label: string;
}

interface BoardProps {
  shape: Shape;
  /** The committed cut for this shape, once made. */
  cut: Line | null;
  grade: Grade | null;
  ghost: Ghost | null;
  showHint: boolean;
  /** Milliseconds before a tap on the board may continue to the next shape. */
  continueAfter: number;
  onAimStart: () => void;
  /** `bOnLeft`: the red piece (side B) ended up on the left of the screen, so the numbers should swap too. */
  onCut: (line: Line, bOnLeft: boolean) => void;
  onMiss: () => void;
  onContinue: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  angle: number;
  color: string;
}

/** Keyboard aim, in screen space: a line through the board centre, shifted along its normal. */
interface KeyAim {
  active: boolean;
  angle: number;
  offset: number;
}

const MIN_SWIPE_PX = 18;
const GHOST_DELAY_MS = 900;
// Shape radius: up to 43% of the board width, never more than 41% of its height.
const FILL_W = 0.43;
const FILL_H = 0.41;
const ENTER_MS = 300;
const MAX_CRUMBS = 16;
const PERFECT_FLAKES = 12;
const OPTICAL_CENTRE = 0.48; // a touch above centre reads as centred
const KEY_STEP_PX = 6;
const KEY_STEP_DEG = 3;
const FINE = 0.2; // Shift = fine aim

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

export function Board(props: BoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const shapeBorn = useRef(performance.now());
  const frozenRotation = useRef<number | null>(null);
  const cutAt = useRef(0);
  const drag = useRef<{ id: number; a: Vec; b: Vec } | null>(null);
  const keyAim = useRef<KeyAim>({ active: false, angle: Math.PI / 2, offset: 0 });
  const particles = useRef<Particle[]>([]);
  const shake = useRef({ until: 0, power: 0 });

  const rotationAt = (now: number) =>
    frozenRotation.current ?? (propsRef.current.shape.spin * (now - shapeBorn.current)) / 1000;

  const viewAt = (now: number): View => {
    const { w, h } = size.current;
    const enter = easeOutCubic(clamp01((now - shapeBorn.current) / ENTER_MS));
    return { cx: w / 2, cy: h * OPTICAL_CENTRE, scale: Math.min(w * FILL_W, h * FILL_H) * (0.92 + 0.08 * enter), rotation: rotationAt(now) };
  };

  // New shape: reset the stage. Layout effects run before the next animation frame,
  // so the canvas never paints one frame of the new shape with the old timing.
  useLayoutEffect(() => {
    shapeBorn.current = performance.now();
    frozenRotation.current = null;
    particles.current = [];
    drag.current = null;
  }, [props.shape]);

  // Cut committed: a few paper crumbs where the blade crossed the outline.
  useLayoutEffect(() => {
    if (!props.cut) return;
    const now = performance.now();
    cutAt.current = now;
    const view = viewAt(now);
    const toScreen = (p: Vec) => {
      const r = rotate(p, view.rotation);
      return { x: view.cx + r.x * view.scale, y: view.cy + r.y * view.scale };
    };
    if (prefersReducedMotion()) {
      cutAt.current = now - 1000; // skip straight to the settled pieces
      return;
    }
    const n = { x: Math.cos(props.cut.angle + view.rotation), y: Math.sin(props.cut.angle + view.rotation) };
    const born: Particle[] = [];
    const crossings = crossingPoints(props.shape.points, props.cut).map(toScreen);
    const perPoint = Math.max(1, Math.floor(MAX_CRUMBS / Math.max(1, crossings.length)));
    for (const p of crossings) {
      for (let i = 0; i < perPoint; i++) born.push(crumb(p, n, Math.random() < 0.5 ? -1 : 1));
    }
    if (props.grade === 'perfect') {
      for (let i = 0; i < PERFECT_FLAKES; i++) born.push(flake(view));
    }
    particles.current.push(...born.slice(0, MAX_CRUMBS + PERFECT_FLAKES));
    if (props.grade === 'butchered' || props.grade === 'off') shake.current = { until: now + 220, power: 4 };
  }, [props.cut]);

  // Canvas sizing (crisp on retina, capped at 2× for mid-range phones).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const { w, h, dpr } = size.current;
      const p = propsRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      if (now < shake.current.until) {
        const k = (shake.current.until - now) / 260;
        ctx.translate((Math.random() - 0.5) * shake.current.power * k, (Math.random() - 0.5) * shake.current.power * k);
      }
      const view = viewAt(now);
      const sinceCut = now - cutAt.current;

      if (p.cut) {
        const sep = 8 * easeOutBack(clamp01((sinceCut - 30) / 380));
        drawShape(ctx, p.shape.points, view, p.cut, { separation: sep });
        const flash = 1 - clamp01(sinceCut / (p.grade === 'perfect' ? 700 : 340));
        if (flash > 0) {
          const [a, b] = lineToScreen(p.cut, view, 3);
          strokeLine(ctx, a, b, `rgba(255, 248, 232, ${flash})`, 1 + 2.5 * flash);
        }
        if (p.grade === 'perfect') drawPulse(ctx, view, sinceCut);
        if (p.ghost && sinceCut > GHOST_DELAY_MS) drawGhost(ctx, p.ghost, view, clamp01((sinceCut - GHOST_DELAY_MS) / 240), w, h);
      } else {
        ctx.globalAlpha = clamp01((now - shapeBorn.current) / (ENTER_MS * 0.6));
        drawShape(ctx, p.shape.points, view, null);
        ctx.globalAlpha = 1;
        const d = drag.current;
        const k = keyAim.current;
        if (d) drawAim(ctx, d.a, d.b, w, h);
        else if (k.active) {
          const [a, b] = keyAimPoints(k, view);
          drawAim(ctx, a, b, w, h);
        } else if (p.showHint) drawHint(ctx, view, now);
      }
      ctx.restore();

      drawParticles(ctx, particles.current, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Shared by pointer and keyboard: screen-space line → local cut, or a miss. */
  const commit = (a: Vec, b: Vec) => {
    const now = performance.now();
    const view = viewAt(now);
    const toLocal = (s: Vec) => rotate({ x: (s.x - view.cx) / view.scale, y: (s.y - view.cy) / view.scale }, -view.rotation);
    const raw = lineThrough(toLocal(a), toLocal(b));
    if (!raw) return;
    const line = snapLine(raw);
    if (!lineCrosses(props.shape.points, line)) {
      shake.current = { until: now + 220, power: 4 };
      props.onMiss();
      return;
    }
    frozenRotation.current = view.rotation;
    props.onCut(line, Math.cos(line.angle + view.rotation) < -0.2);
  };

  const pointFrom = (e: PointerEvent): Vec => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    sound.unlock();
    if (props.cut) {
      if (performance.now() - cutAt.current > props.continueAfter) props.onContinue();
      return;
    }
    if (drag.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = pointFrom(e);
    drag.current = { id: e.pointerId, a: pt, b: pt };
    keyAim.current.active = false;
    props.onAimStart();
    sound.play('aim');
    vibrate(6);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) d.b = pointFrom(e);
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    d.b = pointFrom(e);
    if (Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) < MIN_SWIPE_PX) return;
    commit(d.a, d.b);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (props.cut) return; // Enter/Space during the reveal is handled by the play screen.
    const k = keyAim.current;
    const fine = e.shiftKey ? FINE : 1;
    const turn = ((KEY_STEP_DEG * Math.PI) / 180) * fine;
    switch (e.key) {
      case 'ArrowLeft':
        k.offset -= KEY_STEP_PX * fine;
        break;
      case 'ArrowRight':
        k.offset += KEY_STEP_PX * fine;
        break;
      case 'ArrowUp':
        k.angle -= turn;
        break;
      case 'ArrowDown':
        k.angle += turn;
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        sound.unlock();
        if (!k.active) break;
        const [a, b] = keyAimPoints(k, viewAt(performance.now()));
        commit(a, b);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    if (!k.active) {
      k.active = true;
      props.onAimStart();
    }
  };

  const onFocus = (e: FocusEvent<HTMLCanvasElement>) => {
    // Only show the keyboard blade for keyboard focus, not after a tap.
    if (e.currentTarget.matches(':focus-visible')) keyAim.current.active = true;
  };

  return (
    <div className="board" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        tabIndex={0}
        role="application"
        aria-roledescription="cutting board"
        aria-label={`${props.shape.name}. Swipe across it to cut it in half. With a keyboard: arrow keys aim, Shift for fine aim, Enter cuts.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={() => (keyAim.current.active = false)}
      />
    </div>
  );
}

function keyAimPoints(k: KeyAim, view: View): [Vec, Vec] {
  const n = { x: Math.cos(k.angle), y: Math.sin(k.angle) };
  const d = { x: -n.y, y: n.x };
  const foot = { x: view.cx + n.x * k.offset, y: view.cy + n.y * k.offset };
  const r = view.scale * 1.15;
  return [
    { x: foot.x - d.x * r, y: foot.y - d.y * r },
    { x: foot.x + d.x * r, y: foot.y + d.y * r },
  ];
}

function crumb(p: Vec, n: Vec, side: number): Particle {
  const speed = 40 + Math.random() * 110;
  return {
    x: p.x,
    y: p.y,
    vx: n.x * side * speed + (Math.random() - 0.5) * 50,
    vy: n.y * side * speed + (Math.random() - 0.5) * 50 - 30,
    age: 0,
    life: 380 + Math.random() * 320,
    size: 2 + Math.random() * 2.5,
    spin: (Math.random() - 0.5) * 12,
    angle: Math.random() * Math.PI,
    color: side < 0 ? PALETTE.paper : PALETTE.red,
  };
}

function flake(view: View): Particle {
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
  const speed = 160 + Math.random() * 240;
  return {
    x: view.cx,
    y: view.cy,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    age: 0,
    life: 900 + Math.random() * 500,
    size: 4 + Math.random() * 3,
    spin: (Math.random() - 0.5) * 14,
    angle: Math.random() * Math.PI,
    color: Math.random() < 0.5 ? PALETTE.red : PALETTE.paper,
  };
}

/** The live blade: extends edge to edge so the finger never hides where it will cut. */
function drawAim(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, w: number, h: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 2) {
    dot(ctx, a, 5, PALETTE.red);
    return;
  }
  const reach = Math.hypot(w, h);
  const ux = dx / len;
  const uy = dy / len;
  strokeLine(ctx, { x: a.x - ux * reach, y: a.y - uy * reach }, { x: a.x + ux * reach, y: a.y + uy * reach }, 'rgba(255, 90, 54, 0.5)', 1.5, [5, 6]);
  strokeLine(ctx, a, b, PALETTE.red, 2.5);
  dot(ctx, a, 5, PALETTE.red);
  dot(ctx, b, 8, PALETTE.red);
  dot(ctx, b, 3.5, PALETTE.paper);
}

function dot(ctx: CanvasRenderingContext2D, p: Vec, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHint(ctx: CanvasRenderingContext2D, view: View, now: number) {
  const cycle = 2600;
  const t = (now % cycle) / cycle;
  const travel = easeOutCubic(clamp01((t - 0.12) / 0.5));
  const alpha = t < 0.12 ? t / 0.12 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.15) : 1;
  const angle = -0.42;
  // Starts inside the board, clear of the iOS edge-swipe-back zone.
  const r = view.scale * 1.12;
  const a = { x: view.cx - Math.cos(angle) * r, y: view.cy - Math.sin(angle) * r };
  const b = { x: view.cx + Math.cos(angle) * r, y: view.cy + Math.sin(angle) * r };
  const tip = { x: a.x + (b.x - a.x) * travel, y: a.y + (b.y - a.y) * travel };
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  strokeLine(ctx, a, tip, PALETTE.red, 2.5, [7, 7]);
  ctx.globalAlpha = alpha * 0.4;
  dot(ctx, tip, 18, PALETTE.paper);
  ctx.globalAlpha = alpha;
  dot(ctx, tip, 6, PALETTE.paper);
  ctx.restore();
}

/** PERFECT: one thin ring expanding from the shape. Precise, not loud. */
function drawPulse(ctx: CanvasRenderingContext2D, view: View, since: number) {
  const t = clamp01((since - 120) / 700);
  if (t <= 0 || t >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = PALETTE.paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(view.cx, view.cy, view.scale * (1.02 + 0.35 * easeOutCubic(t)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: Ghost, view: View, alpha: number, w: number, h: number) {
  const [a, b] = lineToScreen(ghost.line, view, 1.25);
  ctx.save();
  ctx.globalAlpha = alpha;
  strokeLine(ctx, a, b, PALETTE.ink, 4, [9, 7]);
  strokeLine(ctx, a, b, PALETTE.paper, 1.75, [9, 7]);
  const anchor = a.y < b.y ? a : b;
  ctx.font = '500 12px "JetBrains Mono", ui-monospace, Menlo, monospace';
  const tw = ctx.measureText(ghost.label).width;
  const bw = tw + 16;
  const bh = 24;
  const x = Math.max(8, Math.min(w - bw - 8, anchor.x - bw / 2));
  const y = Math.max(8, Math.min(h - bh - 8, anchor.y - bh - 6));
  ctx.fillStyle = PALETTE.paper;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(ghost.label, x + 8, y + bh / 2 + 1);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[], dt: number) {
  if (list.length === 0) return;
  const s = dt / 1000;
  let alive = 0;
  for (const p of list) {
    p.age += dt;
    if (p.age >= p.life) continue;
    p.vy += 620 * s;
    p.vx *= 0.985;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.angle += p.spin * s;
    const k = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
    list[alive++] = p;
  }
  list.length = alive;
}
