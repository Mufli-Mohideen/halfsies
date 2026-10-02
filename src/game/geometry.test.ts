import { describe, expect, it } from 'vitest';
import { area, clipToSide, dequantiseLine, lineCrosses, lineThrough, percentOnSideA, quantiseLine, snapLine, type Vec } from './geometry';

const square: Vec[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

// A "U" shape: concave, so a horizontal cut through the arms makes three pieces.
const u: Vec[] = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 3 },
  { x: 2, y: 3 },
  { x: 2, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];

describe('geometry', () => {
  it('computes polygon area', () => {
    expect(area(square)).toBeCloseTo(4);
    expect(area(u)).toBeCloseTo(7);
  });

  it('splits a square exactly in half through the centre at any angle', () => {
    for (let deg = 0; deg < 180; deg += 7) {
      const a = (deg * Math.PI) / 180;
      const line = lineThrough({ x: 0, y: 0 }, { x: Math.cos(a), y: Math.sin(a) })!;
      expect(percentOnSideA(square, line)).toBeCloseTo(50, 9);
    }
  });

  it('measures off-centre cuts', () => {
    const line = lineThrough({ x: 0.5, y: -5 }, { x: 0.5, y: 5 })!;
    const p = percentOnSideA(square, line);
    expect(Math.min(p, 100 - p)).toBeCloseTo(25, 9);
  });

  it('keeps exact areas when a concave shape falls into several pieces', () => {
    const line = lineThrough({ x: -1, y: 2 }, { x: 4, y: 2 })!;
    const a = area(clipToSide(u, line, 'A'));
    const b = area(clipToSide(u, line, 'B'));
    expect(a + b).toBeCloseTo(7, 9);
    expect(Math.min(a, b)).toBeCloseTo(2, 9); // the two arm tips, 1×1 each
  });

  it('detects whether a line touches the shape at all', () => {
    expect(lineCrosses(square, lineThrough({ x: 0, y: -3 }, { x: 0, y: 3 })!)).toBe(true);
    expect(lineCrosses(square, lineThrough({ x: 2, y: -3 }, { x: 2, y: 3 })!)).toBe(false);
  });

  it('quantises lines losslessly enough to preserve the displayed result', () => {
    for (let i = 0; i < 200; i++) {
      const a = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      const b = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      const line = lineThrough(a, b);
      if (!line) continue;
      const snapped = snapLine(line);
      expect(Math.abs(percentOnSideA(square, snapped) - percentOnSideA(square, line))).toBeLessThan(0.01);
      const [qa, qo] = quantiseLine(snapped);
      expect(dequantiseLine(qa, qo)).toEqual(snapped);
    }
  });
});
