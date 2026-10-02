/** Halfsies #1 is 1 October 2026. Each local calendar day after that is the next puzzle. */
const EPOCH_UTC = Date.UTC(2026, 9, 1);
const DAY_MS = 86_400_000;

/** Uses the player's local calendar date, like Wordle: everyone's #N starts at their midnight. */
export function dayNumber(now: Date = new Date()): number {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((local - EPOCH_UTC) / DAY_MS) + 1);
}

export function dateOfDay(day: number): Date {
  const utc = new Date(EPOCH_UTC + (day - 1) * DAY_MS);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDay(day: number): string {
  return dateOfDay(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
