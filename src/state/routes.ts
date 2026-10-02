import { dequantiseLine, type Line } from '../game/geometry';
import { randomSeed } from '../game/rng';
import { scoreRounds, ShapeSequence, type Opponent, type Round, type RunSpec } from '../game/run';
import { decodeChallenge } from '../lib/challengeCodec';
import type { SaveData } from '../lib/storage';

/**
 * URLs:
 *   /                today's puzzle (or its result)
 *   /sudden-death    a fresh Sudden Death run
 *   /c/<code>        a challenge (also ?c=<code>, the edge-function fallback)
 */
export const PATHS = { daily: '/', survival: '/sudden-death' } as const;

export type Route =
  | { kind: 'daily' }
  | { kind: 'survival' }
  | { kind: 'challenge'; spec: RunSpec; opponent: Opponent }
  | { kind: 'invalid-challenge' };

export function readRoute(location: Location = window.location): Route {
  const fromPath = /^\/c\/([^/?#]+)\/?$/.exec(location.pathname)?.[1];
  const code = fromPath ?? new URLSearchParams(location.search).get('c');
  if (code) {
    const data = decodeChallenge(code);
    if (!data) return { kind: 'invalid-challenge' };
    return {
      kind: 'challenge',
      spec: { mode: data.mode, seed: data.seed },
      opponent: { name: data.name, sharerId: data.sharerId, cuts: data.cuts.map(([a, o]) => dequantiseLine(a, o)) },
    };
  }
  if (location.pathname.replace(/\/$/, '') === PATHS.survival) return { kind: 'survival' };
  return { kind: 'daily' };
}

/** Adds a history entry so the phone's back gesture returns to the previous screen instead of leaving. */
export function navigate(path: string, replace = false): void {
  if (window.location.pathname === path && !window.location.search) return;
  try {
    if (replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
  } catch {
    // Sandboxed iframes can refuse history changes; navigation still works in-app.
  }
}

// ---------------------------------------------------------------- screens

export type Screen =
  | { kind: 'play'; spec: RunSpec; opponent: Opponent | null; resume: Line[]; runId: number }
  | { kind: 'result'; spec: RunSpec; rounds: Round[]; opponent: Opponent | null; isNewBest: boolean };

let runCounter = 0;

export function dailyScreen(save: SaveData, day: number, opponent: Opponent | null): Screen {
  const spec: RunSpec = { mode: 'daily', seed: day };
  const record = save.daily[day];
  if (record) {
    const rounds = scoreRounds(new ShapeSequence(spec), record.cuts.map(([a, o]) => dequantiseLine(a, o)));
    return { kind: 'result', spec, rounds, opponent, isNewBest: false };
  }
  const progress = save.dailyProgress?.day === day ? save.dailyProgress.cuts : [];
  return { kind: 'play', spec, opponent, resume: progress.map(([a, o]) => dequantiseLine(a, o)), runId: ++runCounter };
}

export function survivalScreen(seed: number = randomSeed(), opponent: Opponent | null = null): Screen {
  return { kind: 'play', spec: { mode: 'survival', seed }, opponent, resume: [], runId: ++runCounter };
}

export function screenForRoute(route: Route, save: SaveData, today: number): Screen {
  switch (route.kind) {
    case 'survival':
      return survivalScreen();
    case 'challenge':
      return route.spec.mode === 'daily'
        ? dailyScreen(save, route.spec.seed, route.opponent)
        : survivalScreen(route.spec.seed, route.opponent);
    case 'daily':
    case 'invalid-challenge':
      return dailyScreen(save, today, null);
  }
}
