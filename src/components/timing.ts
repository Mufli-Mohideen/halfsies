import type { Mode } from '../game/run';

/**
 * One clock for the reveal, shared by the headline (count-up) and the play screen (verdict sound,
 * auto-advance). Sudden Death runs faster to keep its rhythm.
 */
export const REVEAL = {
  daily: { settle: 520, continueAfter: 480, autoAdvance: null },
  survival: { settle: 360, continueAfter: 280, autoAdvance: 1050 },
} as const satisfies Record<Mode, { settle: number; continueAfter: number; autoAdvance: number | null }>;

/** Auto-advance waits longer when a rival's cut is on screen to compare. */
export const GHOST_AUTO_ADVANCE = 1900;
