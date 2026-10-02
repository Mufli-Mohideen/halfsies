import { describe, expect, it } from 'vitest';
import { decodeChallenge, encodeChallenge, sanitiseName, type ChallengeData } from './challengeCodec';

const sample: ChallengeData = {
  mode: 'daily',
  seed: 142,
  sharerId: 0xdeadbeef,
  score: 431,
  name: 'Sam',
  cuts: [
    [0, 0],
    [65535, 65535],
    [1234, 32768],
    [40000, 100],
    [7, 9],
  ],
};

describe('challenge codec', () => {
  it('round-trips', () => {
    const code = encodeChallenge(sample);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(60);
    expect(decodeChallenge(code)).toEqual(sample);
  });

  it('handles unicode names and truncates long ones', () => {
    const code = encodeChallenge({ ...sample, name: 'Zoë 🔪 the great cutter of shapes' });
    const out = decodeChallenge(code)!;
    expect(out.name).toBe(sanitiseName('Zoë 🔪 the great cutter of shapes'));
    expect(Array.from(out.name).length).toBeLessThanOrEqual(16);
  });

  it('strips control and bidi characters', () => {
    expect(sanitiseName('  a‮b\u0007c  ')).toBe('abc');
  });

  it('rejects garbage and tampered payloads', () => {
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('not a code!')).toBeNull();
    expect(decodeChallenge('AAAA')).toBeNull();
    const code = encodeChallenge(sample);
    expect(decodeChallenge(code.slice(0, -3))).toBeNull();
    expect(decodeChallenge(encodeChallenge({ ...sample, cuts: sample.cuts.slice(0, 3) }))).toBeNull();
  });

  it('supports long sudden death runs', () => {
    const cuts = Array.from({ length: 200 }, (_, i) => [i * 100, i * 50] as [number, number]);
    const data: ChallengeData = { ...sample, mode: 'survival', seed: 99, score: 199, cuts };
    expect(decodeChallenge(encodeChallenge(data))).toEqual(data);
  });
});
