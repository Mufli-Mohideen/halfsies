import { applyAffine, normalise, type Vec } from './geometry';
import { Rng } from './rng';

export type ShapeKind =
  | 'flower'
  | 'star'
  | 'heart'
  | 'gear'
  | 'brokenGear'
  | 'blob'
  | 'cookie'
  | 'skyline'
  | 'totem'
  | 'horseshoe'
  | 'spiral'
  | 'splat';

export type Tier = 1 | 2 | 3 | 4;

export interface Shape {
  kind: ShapeKind;
  name: string;
  /** Simple polygon, normalised to fit inside the unit circle. */
  points: Vec[];
  /** Radians per second; 0 for a still shape. */
  spin: number;
}

const TAU = Math.PI * 2;

const NAMES: Record<ShapeKind, string> = {
  flower: 'The Flower',
  star: 'The Star',
  heart: 'The Heart',
  gear: 'The Gear',
  brokenGear: 'The Broken Gear',
  blob: 'The Blob',
  cookie: 'The Cookie',
  skyline: 'The Skyline',
  totem: 'The Totem',
  horseshoe: 'The Horseshoe',
  spiral: 'The Spiral',
  splat: 'The Splat',
};

const KINDS_BY_TIER: Record<Tier, readonly ShapeKind[]> = {
  1: ['flower', 'star', 'heart', 'gear'],
  2: ['blob', 'cookie', 'brokenGear', 'skyline', 'star'],
  3: ['blob', 'cookie', 'horseshoe', 'totem', 'splat'],
  4: ['spiral', 'splat', 'horseshoe', 'totem'],
};

// ---------------------------------------------------------------- radial shapes

type RadialFn = (theta: number) => number;

function sampleRadial(fn: RadialFn, count = 192): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU;
    const r = fn(t);
    pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
  }
  return pts;
}

/** Keeps a radial profile's smallest radius at `floor` so lobes never pinch through the centre. */
function liftFloor(radii: number[], floor: number): number[] {
  const min = Math.min(...radii);
  if (min >= floor) return radii;
  const k = (1 - floor) / (1 - min);
  return radii.map((r) => 1 - (1 - r) * k);
}

function harmonicRadii(rng: Rng, wildness: number, count: number, floor: number): number[] {
  const terms = 3 + Math.round(wildness * 3);
  const waves: { k: number; amp: number; phase: number }[] = [];
  for (let i = 0; i < terms; i++) {
    const k = 2 + i;
    waves.push({
      k,
      amp: rng.range(0.03, 0.08 + 0.2 * wildness) / Math.pow(k - 1, 0.6),
      phase: rng.range(0, TAU),
    });
  }
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU;
    let r = 1;
    for (const w of waves) r += w.amp * Math.sin(w.k * t + w.phase);
    radii.push(r);
  }
  return liftFloor(radii, floor);
}

function radialFromRadii(radii: number[]): Vec[] {
  const n = radii.length;
  return radii.map((r, i) => {
    const t = (i / n) * TAU;
    return { x: Math.cos(t) * r, y: Math.sin(t) * r };
  });
}

interface Bite {
  cx: number;
  cy: number;
  r: number;
}

/** Takes circular bites out of a star-shaped outline by pulling rays back to the bite's edge. */
function biteRadial(points: Vec[], bites: readonly Bite[]): Vec[] {
  return points.map((p) => {
    let r = Math.hypot(p.x, p.y);
    const ux = p.x / r;
    const uy = p.y / r;
    for (const b of bites) {
      const uc = ux * b.cx + uy * b.cy;
      const disc = uc * uc - (b.cx * b.cx + b.cy * b.cy) + b.r * b.r;
      if (disc <= 0) continue;
      const near = uc - Math.sqrt(disc);
      const far = uc + Math.sqrt(disc);
      if (near < r && r < far) r = Math.max(0.18, near);
    }
    return { x: ux * r, y: uy * r };
  });
}

function randomBites(rng: Rng, count: number): Bite[] {
  const bites: Bite[] = [];
  const start = rng.range(0, TAU);
  for (let i = 0; i < count; i++) {
    const a = start + (i / count) * TAU + rng.range(-0.6, 0.6);
    const d = rng.range(1.0, 1.12);
    bites.push({ cx: Math.cos(a) * d, cy: Math.sin(a) * d, r: rng.range(0.24, 0.42) });
  }
  return bites;
}

// Odd counts on purpose: an even-fold shape is point-symmetric, so any cut through
// its centre would be a free perfect.
function flower(rng: Rng): Vec[] {
  const petals = rng.pick([5, 7]);
  const depth = rng.range(0.3, 0.45);
  return sampleRadial((t) => 1 - depth + depth * Math.pow(Math.abs(Math.cos((petals * t) / 2)), 0.7), 240);
}

function star(rng: Rng, jitter: number): Vec[] {
  const tips = jitter < 0.05 ? rng.pick([5, 7]) : rng.int(5, 8);
  const inner = rng.range(0.42, 0.62);
  const pts: Vec[] = [];
  for (let i = 0; i < tips * 2; i++) {
    const base = i % 2 === 0 ? 1 : inner;
    const r = base * (1 + rng.range(-jitter, jitter));
    const t = (i / (tips * 2)) * TAU + rng.range(-jitter, jitter) * 0.4;
    pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
  }
  return pts;
}

function heart(): Vec[] {
  const pts: Vec[] = [];
  const n = 200;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x, y });
  }
  return pts;
}

function gear(rng: Rng, missing: number): Vec[] {
  const teeth = rng.pick([9, 11, 13]);
  const depth = rng.range(0.14, 0.22);
  const gone = new Set<number>();
  while (gone.size < missing) gone.add(rng.int(0, teeth - 1));
  const pts: Vec[] = [];
  const step = TAU / teeth;
  const pushArc = (from: number, to: number, r: number) => {
    const segs = 4;
    for (let s = 0; s <= segs; s++) {
      const t = from + ((to - from) * s) / segs;
      pts.push({ x: Math.cos(t) * r, y: Math.sin(t) * r });
    }
  };
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const outer = gone.has(i) ? 1 - depth : 1;
    pushArc(a, a + step * 0.12, 1 - depth);
    pushArc(a + step * 0.2, a + step * 0.55, outer);
    pushArc(a + step * 0.63, a + step * 0.95, 1 - depth);
  }
  return pts;
}

function blob(rng: Rng, wildness: number): Vec[] {
  return radialFromRadii(harmonicRadii(rng, wildness, 200, 0.32));
}

function cookie(rng: Rng, bites: number): Vec[] {
  const base = radialFromRadii(harmonicRadii(rng, 0.05, 200, 0.85));
  return biteRadial(base, randomBites(rng, bites));
}

/** A paint splat: a few big lobes plus high-frequency spikes. */
function splat(rng: Rng): Vec[] {
  const body = harmonicRadii(rng, 0.7, 260, 0.4);
  const spikes = rng.int(5, 9);
  const spikeAt = Array.from({ length: spikes }, () => ({ t: rng.range(0, TAU), w: rng.range(0.05, 0.12), h: rng.range(0.25, 0.5) }));
  const radii = body.map((r, i) => {
    const t = (i / body.length) * TAU;
    let bump = 0;
    for (const s of spikeAt) {
      let d = Math.abs(t - s.t);
      d = Math.min(d, TAU - d);
      if (d < s.w) bump = Math.max(bump, s.h * (1 - d / s.w));
    }
    return r * 0.78 + bump;
  });
  return radialFromRadii(radii);
}

// ------------------------------------------------------------ outline shapes

/** Columns standing on a baseline (one-sided) or around a spine (two-sided totem). */
function columns(rng: Rng, twoSided: boolean): Vec[] {
  const count = rng.int(5, 8);
  const xs = [0];
  for (let i = 0; i < count; i++) xs.push(xs[i]! + rng.range(0.55, 1.45));
  const tops = Array.from({ length: count }, () => rng.range(0.6, 3.2));
  const bottoms = Array.from({ length: count }, () => (twoSided ? rng.range(0.2, 2.2) : 0));
  const pts: Vec[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({ x: xs[i]!, y: -tops[i]! }, { x: xs[i + 1]!, y: -tops[i]! });
  }
  for (let i = count - 1; i >= 0; i--) {
    pts.push({ x: xs[i + 1]!, y: bottoms[i]! }, { x: xs[i]!, y: bottoms[i]! });
  }
  return pts;
}

function horseshoe(rng: Rng, taper: number): Vec[] {
  const span = rng.range(Math.PI * 1.1, Math.PI * 1.7);
  const a0 = -span / 2;
  const a1 = span / 2;
  const w0 = rng.range(0.16, 0.24);
  const w1 = w0 * (1 - rng.range(0, taper));
  const steps = 90;
  const mid = 1 - Math.max(w0, w1);
  const widthAt = (t: number) => w0 + (w1 - w0) * t;
  const outer: Vec[] = [];
  const inner: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    const w = widthAt(t);
    outer.push({ x: Math.cos(a) * (mid + w), y: Math.sin(a) * (mid + w) });
    inner.push({ x: Math.cos(a) * (mid - w), y: Math.sin(a) * (mid - w) });
  }
  const cap = (a: number, w: number, forward: boolean): Vec[] => {
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const tx = forward ? -uy : uy;
    const ty = forward ? ux : -ux;
    const cx = ux * mid;
    const cy = uy * mid;
    const pts: Vec[] = [];
    for (let i = 1; i < 16; i++) {
      const phi = (i / 16) * Math.PI;
      const sx = forward ? Math.cos(phi) : -Math.cos(phi);
      pts.push({ x: cx + w * (sx * ux + Math.sin(phi) * tx), y: cy + w * (sx * uy + Math.sin(phi) * ty) });
    }
    return pts;
  };
  return [...outer, ...cap(a1, w1, true), ...inner.reverse(), ...cap(a0, w0, false)];
}

function spiral(rng: Rng): Vec[] {
  const turns = rng.range(1.7, 2.4);
  const end = turns * TAU;
  const b = 1 / (end + 2);
  const w = Math.PI * b * rng.range(0.5, 0.68);
  const r0 = w + 0.04;
  const steps = 260;
  const outer: Vec[] = [];
  const inner: Vec[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * end;
    const r = r0 + b * t;
    outer.push({ x: Math.cos(t) * (r + w), y: Math.sin(t) * (r + w) });
    inner.push({ x: Math.cos(t) * (r - w), y: Math.sin(t) * (r - w) });
  }
  return [...outer, ...inner.reverse()];
}

// ---------------------------------------------------------------- assembly

function outlineFor(kind: ShapeKind, rng: Rng, tier: Tier): Vec[] {
  switch (kind) {
    case 'flower':
      return flower(rng);
    case 'star':
      return star(rng, tier === 1 ? 0.03 : 0.16);
    case 'heart':
      return heart();
    case 'gear':
      return gear(rng, 0);
    case 'brokenGear':
      return gear(rng, rng.int(1, 3));
    case 'blob':
      return blob(rng, tier === 2 ? 0.35 : 0.8);
    case 'cookie':
      return cookie(rng, tier === 2 ? 1 : rng.int(2, 3));
    case 'skyline':
      return columns(rng, false);
    case 'totem':
      return columns(rng, true);
    case 'horseshoe':
      return horseshoe(rng, tier >= 4 ? 0.65 : 0.35);
    case 'spiral':
      return spiral(rng);
    case 'splat':
      return splat(rng);
  }
}

export interface ShapeOptions {
  tier: Tier;
  spin?: boolean;
  avoid?: ReadonlySet<ShapeKind>;
}

export function makeShape(key: string, { tier, spin = false, avoid }: ShapeOptions): Shape {
  const rng = Rng.from(key);
  const pool = KINDS_BY_TIER[tier].filter((k) => !avoid?.has(k));
  const kind = rng.pick(pool.length > 0 ? pool : KINDS_BY_TIER[tier]);
  const outline = outlineFor(kind, rng, tier);
  // Squash and shear break visual symmetry while keeping area ratios honest.
  const stretch = rng.range(0.82, 1.18);
  const transformed = applyAffine(outline, {
    scaleX: stretch,
    scaleY: 1 / stretch,
    shear: rng.range(-0.12, 0.12) * tier,
    rotation: rng.range(0, TAU),
  });
  return {
    kind,
    name: NAMES[kind],
    points: normalise(transformed),
    spin: spin ? rng.sign() * rng.range(0.45, 0.7) : 0,
  };
}

// ---------------------------------------------------------------- runs
//
// FROZEN AFTER LAUNCH. Every daily puzzle, saved result and challenge link is
// regenerated from these functions. Changing any generator above (or the order
// of rng calls) silently changes past puzzles. To evolve shapes, add a new
// generator and switch to it from a specific day number onwards.

export const DAILY_ROUNDS = 5;
const DAILY_TIERS: readonly Tier[] = [1, 2, 2, 3, 4];

export function dailyShapes(day: number): Shape[] {
  const used = new Set<ShapeKind>();
  return DAILY_TIERS.map((tier, i) => {
    const shape = makeShape(`daily:${day}:${i}`, { tier, spin: i === DAILY_ROUNDS - 1, avoid: used });
    used.add(shape.kind);
    return shape;
  });
}

export function survivalTier(index: number): Tier {
  return Math.min(4, 1 + Math.floor(index / 3)) as Tier;
}

export function survivalShape(seed: number, index: number): Shape {
  const spins = index >= 7 && Rng.from(`sd-spin:${seed}:${index}`).chance(Math.min(0.75, 0.3 + index * 0.03));
  return makeShape(`sd:${seed}:${index}`, { tier: survivalTier(index), spin: spins });
}
