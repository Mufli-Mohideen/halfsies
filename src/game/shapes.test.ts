import { describe, expect, it } from 'vitest';
import { area, signedArea, type Vec } from './geometry';
import { dailyShapes, makeShape, survivalShape, type Tier } from './shapes';

function segmentsIntersect(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const cross = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12;
}

function isSimple(poly: readonly Vec[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return false;
    }
  }
  return true;
}

describe('shapes', () => {
  it('is deterministic for the same day', () => {
    expect(dailyShapes(42)).toEqual(dailyShapes(42));
    expect(dailyShapes(42)).not.toEqual(dailyShapes(43));
  });

  it('gives five different kinds per day, with a spinning finale', () => {
    for (let day = 1; day < 60; day++) {
      const shapes = dailyShapes(day);
      expect(shapes).toHaveLength(5);
      expect(new Set(shapes.map((s) => s.kind)).size).toBe(5);
      expect(shapes[4]!.spin).not.toBe(0);
      expect(shapes.slice(0, 4).every((s) => s.spin === 0)).toBe(true);
    }
  });

  it('only produces simple, non-degenerate polygons inside the unit circle', () => {
    for (let i = 0; i < 400; i++) {
      const tier = ((i % 4) + 1) as Tier;
      const shape = makeShape(`test:${i}`, { tier });
      expect(isSimple(shape.points), `${shape.kind} #${i}`).toBe(true);
      expect(area(shape.points)).toBeGreaterThan(0.25);
      expect(Math.abs(signedArea(shape.points))).toBeGreaterThan(0);
      for (const p of shape.points) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('ramps sudden death difficulty', () => {
    expect(survivalShape(7, 0).spin).toBe(0);
    expect(survivalShape(7, 3)).toEqual(survivalShape(7, 3));
  });
});
