import { randomSeed } from '../game/rng';

export type QuantCut = [number, number];

export interface DailyRecord {
  cuts: QuantCut[];
  points: number[];
  total: number;
  /** Played after its own day (e.g. via an old challenge link): kept, but never counts for streaks. */
  late: boolean;
}

export interface SaveData {
  v: 1;
  playerId: number;
  firstSeenDay: number;
  name: string;
  muted: boolean;
  hasCut: boolean;
  daily: Record<number, DailyRecord>;
  /** Cuts already made in today's daily, so a reload can't re-roll a bad cut. */
  dailyProgress: { day: number; cuts: QuantCut[] } | null;
  survivalBest: number;
  survivalRuns: number;
  perfects: number;
}

export const SAVE_KEY = 'halfsies:v1';

export function defaultSave(today: number): SaveData {
  return {
    v: 1,
    playerId: randomSeed(),
    firstSeenDay: today,
    name: '',
    muted: false,
    hasCut: false,
    daily: {},
    dailyProgress: null,
    survivalBest: 0,
    survivalRuns: 0,
    perfects: 0,
  };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isU16 = (v: unknown): v is number => isInt(v) && v >= 0 && v <= 0xffff;

function isCutList(v: unknown): v is QuantCut[] {
  return Array.isArray(v) && v.every((c) => Array.isArray(c) && c.length === 2 && isU16(c[0]) && isU16(c[1]));
}

function readRecord(v: unknown): DailyRecord | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Partial<DailyRecord>;
  if (!isCutList(r.cuts) || !Array.isArray(r.points) || !r.points.every(isInt) || !isInt(r.total)) return null;
  return { cuts: r.cuts, points: r.points, total: r.total, late: r.late === true };
}

/** Never trusts what's on disk: anything malformed falls back to defaults field by field. */
export function loadSave(today: number): SaveData {
  const base = defaultSave(today);
  let raw: unknown;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return base;
    raw = JSON.parse(text);
  } catch {
    return base;
  }
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return base;
  const r = raw as Record<string, unknown>;

  const daily: Record<number, DailyRecord> = {};
  if (r.daily && typeof r.daily === 'object') {
    for (const [day, rec] of Object.entries(r.daily as Record<string, unknown>)) {
      const parsed = readRecord(rec);
      if (parsed && /^\d+$/.test(day)) daily[Number(day)] = parsed;
    }
  }
  const progress = r.dailyProgress as SaveData['dailyProgress'] | undefined;

  return {
    v: 1,
    playerId: isInt(r.playerId) ? r.playerId >>> 0 : base.playerId,
    firstSeenDay: isInt(r.firstSeenDay) ? r.firstSeenDay : today,
    name: typeof r.name === 'string' ? r.name.slice(0, 32) : '',
    muted: r.muted === true,
    hasCut: r.hasCut === true,
    daily,
    dailyProgress:
      progress && isInt(progress.day) && isCutList(progress.cuts) && progress.day === today ? progress : null,
    survivalBest: isInt(r.survivalBest) ? r.survivalBest : 0,
    survivalRuns: isInt(r.survivalRuns) ? r.survivalRuns : 0,
    perfects: isInt(r.perfects) ? r.perfects : 0,
  };
}

/** Best effort: private browsing or a full disk must never break the game. */
export function writeSave(save: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export interface DailyStats {
  played: number;
  streak: number;
  maxStreak: number;
  average: number;
  best: number;
  /** Counts per 100-point band: 0–99 … 400–500. */
  bands: number[];
}

export function dailyStats(save: SaveData, today: number): DailyStats {
  const entries = Object.entries(save.daily).map(([d, r]) => ({ day: Number(d), rec: r }));
  const onTime = new Set(entries.filter((e) => !e.rec.late).map((e) => e.day));

  let streak = 0;
  for (let d = onTime.has(today) ? today : today - 1; onTime.has(d); d--) streak++;

  let maxStreak = 0;
  let run = 0;
  for (const day of [...onTime].sort((a, b) => a - b)) {
    run = onTime.has(day - 1) ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
  }

  const totals = entries.map((e) => e.rec.total);
  const bands = [0, 0, 0, 0, 0];
  for (const t of totals) bands[Math.min(4, Math.floor(t / 100))]!++;

  return {
    played: entries.length,
    streak,
    maxStreak,
    average: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
    best: totals.length ? Math.max(...totals) : 0,
    bands,
  };
}
