import { describe, expect, it } from 'vitest';
import { lineThrough } from './geometry';
import { compare, scoreRounds, ShapeSequence, survivedCount } from './run';
import { gradeFor, pointsFor, scoreCut, survivalTolerance } from './scoring';

const square = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

describe('scoring', () => {
  it('rewards precision steeply', () => {
    expect(pointsFor(0)).toBe(100);
    expect(pointsFor(0.04)).toBe(100);
    expect(pointsFor(0.06)).toBe(99);
    expect(pointsFor(2)).toBe(80);
    expect(pointsFor(10)).toBe(0);
    expect(pointsFor(30)).toBe(0);
  });

  it('grades a centre cut as perfect', () => {
    const s = scoreCut(square, lineThrough({ x: 0, y: -2 }, { x: 0, y: 2 })!);
    expect(s.grade).toBe('perfect');
    expect(s.points).toBe(100);
    expect(gradeFor(7)).toBe('butchered');
  });

  it('tightens sudden death tolerance to a floor', () => {
    expect(survivalTolerance(0)).toBe(5);
    expect(survivalTolerance(5)).toBe(3.5);
    expect(survivalTolerance(100)).toBe(1);
  });

  it('compares head-to-head runs by score and per-shape wins', () => {
    const seq = new ShapeSequence({ mode: 'daily', seed: 3 });
    const through = (y: number) => lineThrough({ x: -2, y }, { x: 2, y })!;
    const mine = scoreRounds(seq, [0, 0, 0, 0, 0].map(() => through(0.01)));
    const theirs = scoreRounds(seq, [0, 0, 0, 0, 0].map(() => through(0.4)));
    const h2h = compare('daily', mine, theirs);
    expect(h2h.you).toBe(mine.reduce((s, r) => s + r.score.points, 0));
    expect(h2h.roundsWon + h2h.roundsLost).toBeLessThanOrEqual(5);
  });

  it('counts survived cuts up to the first failure', () => {
    const seq = new ShapeSequence({ mode: 'survival', seed: 9 });
    const far = lineThrough({ x: -2, y: 0.9 }, { x: 2, y: 0.9 })!;
    expect(survivedCount(scoreRounds(seq, [far]))).toBe(0);
  });
});
