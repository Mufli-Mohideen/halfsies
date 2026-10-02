import type { Line } from './geometry';
import { DAILY_ROUNDS, dailyShapes, survivalShape, type Shape } from './shapes';
import { scoreCut, survives, type CutScore } from './scoring';

export type Mode = 'daily' | 'survival';

/** Everything needed to regenerate the exact same sequence of shapes. */
export interface RunSpec {
  mode: Mode;
  /** Daily: the puzzle number. Sudden Death: a random 32-bit seed. */
  seed: number;
}

export interface Opponent {
  name: string;
  /** Anonymous id of the person who shared, for viral-loop attribution. */
  sharerId: number;
  cuts: Line[];
}

export interface Round {
  shape: Shape;
  line: Line;
  score: CutScore;
}

export function displayName(name: string): string {
  return name.trim() || 'Your friend';
}

export class ShapeSequence {
  private readonly cache: Shape[] = [];

  constructor(readonly spec: RunSpec) {
    if (spec.mode === 'daily') this.cache = dailyShapes(spec.seed);
  }

  get length(): number {
    return this.spec.mode === 'daily' ? DAILY_ROUNDS : Infinity;
  }

  at(index: number): Shape {
    let shape = this.cache[index];
    if (!shape) {
      shape = survivalShape(this.spec.seed, index);
      this.cache[index] = shape;
    }
    return shape;
  }
}

export function scoreRounds(sequence: ShapeSequence, lines: readonly Line[]): Round[] {
  return lines.map((line, i) => {
    const shape = sequence.at(i);
    return { shape, line, score: scoreCut(shape.points, line) };
  });
}

export function totalPoints(rounds: readonly Round[]): number {
  return rounds.reduce((sum, r) => sum + r.score.points, 0);
}

/** Daily: total points. Sudden Death: number of cuts survived. */
export function runScore(mode: Mode, rounds: readonly Round[]): number {
  return mode === 'daily' ? totalPoints(rounds) : survivedCount(rounds);
}

export function survivedCount(rounds: readonly Round[]): number {
  let n = 0;
  for (const r of rounds) {
    if (!survives(r.score.deviation, n)) break;
    n++;
  }
  return n;
}

export function isRunOver(spec: RunSpec, rounds: readonly Round[]): boolean {
  if (spec.mode === 'daily') return rounds.length >= DAILY_ROUNDS;
  const last = rounds[rounds.length - 1];
  return last !== undefined && !survives(last.score.deviation, rounds.length - 1);
}

export interface HeadToHead {
  you: number;
  them: number;
  roundsWon: number;
  roundsLost: number;
  outcome: 'win' | 'loss' | 'draw';
}

export function compare(mode: Mode, mine: readonly Round[], theirs: readonly Round[]): HeadToHead {
  let roundsWon = 0;
  let roundsLost = 0;
  const n = Math.min(mine.length, theirs.length);
  for (let i = 0; i < n; i++) {
    const a = mine[i]!.score.deviation;
    const b = theirs[i]!.score.deviation;
    if (a < b) roundsWon++;
    else if (b < a) roundsLost++;
  }
  const you = runScore(mode, mine);
  const them = runScore(mode, theirs);
  // Sudden Death ties are broken by accumulated accuracy across the shared rounds.
  const tieBreak = mode === 'survival' && you === them ? roundsWon - roundsLost : 0;
  const diff = you - them || tieBreak;
  return { you, them, roundsWon, roundsLost, outcome: diff > 0 ? 'win' : diff < 0 ? 'loss' : 'draw' };
}
