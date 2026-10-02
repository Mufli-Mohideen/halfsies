import { afterEach, describe, expect, it, vi } from 'vitest';
import { dailyStats, loadSave, SAVE_KEY, writeSave } from './storage';

function stubStorage(initial: Record<string, string> = {}, { throws = false } = {}) {
  const data = { ...initial };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => {
      if (throws) throw new DOMException('blocked', 'SecurityError');
      return data[k] ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new DOMException('full', 'QuotaExceededError');
      data[k] = v;
    },
  });
  return data;
}

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts fresh when nothing is saved', () => {
    stubStorage();
    const s = loadSave(10);
    expect(s.firstSeenDay).toBe(10);
    expect(s.daily).toEqual({});
  });

  it('survives corrupt JSON and wrong shapes field by field', () => {
    stubStorage({ [SAVE_KEY]: '{"v":1,"daily":{"3":{"cuts":"x"},"4":{"cuts":[[1,2]],"points":[90],"total":90}},"name":42,"perfects":"lots"' });
    expect(loadSave(5).daily).toEqual({});
    stubStorage({
      [SAVE_KEY]: JSON.stringify({ v: 1, name: 42, perfects: 'lots', daily: { 3: { cuts: 'x' }, 4: { cuts: [[1, 2]], points: [90], total: 90 } } }),
    });
    const s = loadSave(5);
    expect(s.name).toBe('');
    expect(s.perfects).toBe(0);
    expect(Object.keys(s.daily)).toEqual(['4']);
  });

  it('drops yesterday’s half-finished progress', () => {
    stubStorage({ [SAVE_KEY]: JSON.stringify({ v: 1, dailyProgress: { day: 4, cuts: [[1, 2]] } }) });
    expect(loadSave(5).dailyProgress).toBeNull();
  });

  it('keeps working when storage is blocked', () => {
    stubStorage({}, { throws: true });
    const s = loadSave(5);
    expect(s.v).toBe(1);
    expect(writeSave(s)).toBe(false);
  });

  it('counts streaks from on-time days only', () => {
    stubStorage();
    const s = loadSave(10);
    const rec = (total: number, late = false) => ({ cuts: [], points: [], total, late });
    s.daily = { 7: rec(300), 8: rec(400), 9: rec(350), 10: rec(450), 2: rec(100, true) };
    const stats = dailyStats(s, 10);
    expect(stats.streak).toBe(4);
    expect(stats.maxStreak).toBe(4);
    expect(stats.best).toBe(450);
    expect(stats.played).toBe(5);
  });
});
