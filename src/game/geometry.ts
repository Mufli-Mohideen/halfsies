export interface Vec {
  x: number;
  y: number;
}

export type Polygon = readonly Vec[];

/**
 * An infinite cut line in normal form: all points p where n·p = offset,
 * with n = (cos angle, sin angle). Side A is n·p < offset, side B is n·p > offset.
 */
export interface Line {
  angle: number;
  offset: number;
}

const TAU = Math.PI * 2;

export function vec(x: number, y: number): Vec {
  return { x, y };
}

export function normalOf(line: Line): Vec {
  return { x: Math.cos(line.angle), y: Math.sin(line.angle) };
}

export function signedDistance(p: Vec, line: Line): number {
  return p.x * Math.cos(line.angle) + p.y * Math.sin(line.angle) - line.offset;
}

/** Shoelace formula. Positive for counter-clockwise polygons (in y-up space). */
export function signedArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function area(poly: Polygon): number {
  return Math.abs(signedArea(poly));
}

/**
 * Sutherland–Hodgman clip against one half-plane. Works for concave polygons too:
 * separate pieces end up joined by zero-area bridges along the line, so the
 * area of the result is exact even though its outline is degenerate.
 */
export function clipToSide(poly: Polygon, line: Line, side: 'A' | 'B'): Vec[] {
  const sign = side === 'A' ? -1 : 1;
  const out: Vec[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i]!;
    const next = poly[(i + 1) % n]!;
    const dc = sign * signedDistance(cur, line);
    const dn = sign * signedDistance(next, line);
    if (dc >= 0) out.push(cur);
    if ((dc >= 0) !== (dn >= 0)) {
      const t = dc / (dc - dn);
      out.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return out;
}

/** Percentage (0–100) of the polygon's area lying on side A of the line. */
export function percentOnSideA(poly: Polygon, line: Line): number {
  const total = area(poly);
  if (total === 0) return 0;
  return (area(clipToSide(poly, line, 'A')) / total) * 100;
}

/** True when the line actually passes through the polygon (vertices on both sides). */
export function lineCrosses(poly: Polygon, line: Line): boolean {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = signedDistance(p, line);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return min < 0 && max > 0;
}

/** Canonical line through two points, with angle normalised into [0, π). */
export function lineThrough(a: Vec, b: Vec): Line | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const nx = -dy / len;
  const ny = dx / len;
  return canonicalLine({ angle: Math.atan2(ny, nx), offset: nx * a.x + ny * a.y });
}

export function canonicalLine(line: Line): Line {
  let { angle, offset } = line;
  angle = ((angle % TAU) + TAU) % TAU;
  if (angle >= Math.PI) {
    angle -= Math.PI;
    offset = -offset;
  }
  return { angle, offset };
}

/** Points where the line crosses the polygon outline (used for cut particles). */
export function crossingPoints(poly: Polygon, line: Line): Vec[] {
  const pts: Vec[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const da = signedDistance(a, line);
    const db = signedDistance(b, line);
    if ((da < 0) !== (db < 0)) {
      const t = da / (da - db);
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return pts;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(poly: Polygon): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export interface Affine {
  scaleX: number;
  scaleY: number;
  shear: number;
  rotation: number;
}

export function applyAffine(poly: Polygon, t: Affine): Vec[] {
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  return poly.map((p) => {
    const x = p.x * t.scaleX + p.y * t.shear;
    const y = p.y * t.scaleY;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  });
}

/**
 * Centres the polygon on its bounding box and scales it so it fits inside the
 * unit circle (so it never clips when it spins).
 */
export function normalise(poly: Polygon): Vec[] {
  const b = boundsOf(poly);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  let r = 0;
  for (const p of poly) r = Math.max(r, Math.hypot(p.x - cx, p.y - cy));
  const s = r > 0 ? 1 / r : 1;
  return poly.map((p) => ({ x: (p.x - cx) * s, y: (p.y - cy) * s }));
}

export function rotate(p: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

// ---- Quantisation: lets a cut travel inside a short URL and replay exactly. ----

const OFFSET_RANGE = 2;
const Q = 0xffff;

export function quantiseLine(line: Line): [number, number] {
  const c = canonicalLine(line);
  const qa = Math.round((c.angle / Math.PI) * Q);
  const clamped = Math.max(-OFFSET_RANGE, Math.min(OFFSET_RANGE, c.offset));
  const qo = Math.round(((clamped + OFFSET_RANGE) / (OFFSET_RANGE * 2)) * Q);
  return [qa, qo];
}

export function dequantiseLine(qa: number, qo: number): Line {
  return {
    angle: (qa / Q) * Math.PI,
    offset: (qo / Q) * OFFSET_RANGE * 2 - OFFSET_RANGE,
  };
}

/** Round-trips a line through quantisation so local and shared results always match. */
export function snapLine(line: Line): Line {
  const [qa, qo] = quantiseLine(line);
  return dequantiseLine(qa, qo);
}
