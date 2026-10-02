/**
 * Fire-and-forget product analytics. The game never waits on or depends on this.
 *
 * Privacy: no names, no cuts, no fingerprinting. Each device gets a random
 * anonymous id. Nothing is sent when the browser signals Global Privacy
 * Control or Do Not Track, or when no sink is configured.
 *
 * Sinks (all optional):
 *  - VITE_ANALYTICS_ENDPOINT: receives `{ event, props, ...context }` as JSON via sendBeacon.
 *  - window.plausible: used automatically if a Plausible script is added to index.html.
 *
 * README → "Analytics" maps each event to the metric it powers.
 */

import { randomSeed } from '../game/rng';

export type AnalyticsEvent =
  | 'game_loaded'
  | 'game_started'
  | 'round_cut'
  | 'game_completed'
  | 'game_retried'
  | 'new_high_score'
  | 'share_clicked'
  | 'share_completed'
  | 'challenge_created'
  | 'challenge_opened'
  | 'challenge_invalid'
  | 'challenge_completed'
  | 'session_end';

type Props = Record<string, string | number | boolean>;

interface Context {
  pid: number;
  /** Days since this device first played (0 = first day): Day-N retention without accounts. */
  age: number;
  day: number;
  /** Anonymous id of whoever shared the link this visit came from. */
  ref: number | null;
}

const endpoint = (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined) || null;
const sessionId = randomSeed().toString(36);
const sessionStart = Date.now();
let context: Context | null = null;

function optedOut(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
  } catch {
    return false;
  }
}

const disabled = optedOut();

export function initAnalytics(ctx: Context): void {
  const first = context === null;
  context = ctx;
  if (!first) return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      track('session_end', { seconds: Math.round((Date.now() - sessionStart) / 1000) });
    }
  });
}

export function setReferrer(sharerId: number): void {
  if (context) context.ref = sharerId;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (import.meta.env.DEV) console.debug('[track]', event, props);
  if (disabled) return;
  try {
    if (endpoint && navigator.sendBeacon) {
      const payload = { event, props, sid: sessionId, ts: Date.now(), ...context };
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    }
    const plausible = (window as unknown as { plausible?: (e: string, o: { props: Props }) => void }).plausible;
    plausible?.(event, { props });
  } catch {
    // Analytics must never throw into gameplay.
  }
}
