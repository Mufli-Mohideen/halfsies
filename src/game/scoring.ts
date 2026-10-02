import { percentOnSideA, type Line, type Polygon } from './geometry';

export type Grade = 'perfect' | 'surgical' | 'clean' | 'close' | 'off' | 'butchered';

export interface CutScore {
  /** Share of the area on side A, 0–100. */
  percentA: number;
  /** Distance from a perfect 50/50 in percentage points, in steps of 0.1. */
  deviation: number;
  points: number;
  grade: Grade;
}

export const MAX_ROUND_POINTS = 100;

/** Rounded to one decimal the way the player sees it, so "50.0 / 50.0" is always a perfect. */
export function displayPercent(p: number): string {
  return (Math.round(p * 10) / 10).toFixed(1);
}

export function gradeFor(deviation: number): Grade {
  if (deviation < 0.05) return 'perfect';
  if (deviation < 0.5) return 'surgical';
  if (deviation < 1.5) return 'clean';
  if (deviation < 3) return 'close';
  if (deviation < 6) return 'off';
  return 'butchered';
}

export function pointsFor(deviation: number): number {
  if (deviation < 0.05) return MAX_ROUND_POINTS;
  return Math.max(0, Math.min(99, Math.round(MAX_ROUND_POINTS - deviation * 10)));
}

/**
 * Everything is judged at the precision the player sees (0.1%), so a displayed
 * "50.0 / 50.0" is always a perfect and two equal-looking cuts always tie.
 */
export function scoreCut(poly: Polygon, line: Line): CutScore {
  const percentA = percentOnSideA(poly, line);
  const deviation = Math.abs(500 - Math.round(percentA * 10)) / 10;
  return { percentA, deviation, points: pointsFor(deviation), grade: gradeFor(deviation) };
}

const GRADE_LABELS: Record<Grade, readonly string[]> = {
  perfect: ['Perfect'],
  surgical: ['Surgical', 'Precise', 'Clinical'],
  clean: ['Clean', 'Fair', 'Tidy'],
  close: ['Close', 'Nearly', 'Not bad'],
  off: ['Lopsided', 'Uneven', 'Off'],
  butchered: ['Butchered', 'Someone’s upset', 'Big piece energy'],
};

/** Stable flavour text for a cut (same cut → same label, no flicker on re-render). */
export function gradeLabel(score: Pick<CutScore, 'grade' | 'deviation'>): string {
  const options = GRADE_LABELS[score.grade];
  return options[Math.round(score.deviation * 10) % options.length]!;
}

/** Visual weight of a grade. The UI uses three tones, not a rainbow. */
export type Tone = 'perfect' | 'good' | 'fair' | 'bad';

export function toneFor(grade: Grade): Tone {
  if (grade === 'perfect') return 'perfect';
  if (grade === 'surgical' || grade === 'clean') return 'good';
  if (grade === 'close') return 'fair';
  return 'bad';
}

/** The smaller piece, which is what "how fair was it" reads as (47.8 rather than 52.2). */
export function smallerShare(score: Pick<CutScore, 'percentA'>): number {
  return Math.min(score.percentA, 100 - score.percentA);
}

/** Share-text squares (data, Wordle-style), not UI icons. */
export const GRADE_EMOJI: Record<Grade, string> = {
  perfect: '🟪',
  surgical: '🟩',
  clean: '🟩',
  close: '🟨',
  off: '🟧',
  butchered: '🟥',
};

export function rankFor(total: number): string {
  if (total >= 495) return 'Laser-guided';
  if (total >= 470) return 'Surgeon';
  if (total >= 440) return 'Steady hand';
  if (total >= 390) return 'Fair dealer';
  if (total >= 320) return 'Eyeballer';
  if (total >= 240) return 'Wobbly';
  return 'Chainsaw';
}

// ---- Sudden Death: one cut outside the tolerance ends the run. ----

export function survivalTolerance(index: number): number {
  return Math.max(1, Math.round((5 - index * 0.3) * 10) / 10);
}

export function survives(deviation: number, index: number): boolean {
  return deviation <= survivalTolerance(index);
}
