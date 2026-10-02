/**
 * Challenge links carry the whole game state needed to replay a friend's run:
 * which shapes, who cut them, and every cut they made. No backend required.
 *
 * Kept free of DOM and Vite APIs: the Vercel edge function imports it too.
 *
 * Layout (big-endian):
 *   u8 version | u8 mode | u32 seed | u32 sharerId | u16 score
 *   u8 nameBytes | utf8 name | u8 cutCount | cutCount × (u16 angle, u16 offset)
 */

export type ChallengeMode = 'daily' | 'survival';

export interface ChallengeData {
  mode: ChallengeMode;
  seed: number;
  sharerId: number;
  /** Score as the sharer saw it. Display hint only; the game recomputes from the cuts. */
  score: number;
  name: string;
  /** Quantised cuts: [angle, offset] pairs of u16. */
  cuts: [number, number][];
}

const VERSION = 1;
const MAX_NAME_CHARS = 16;
const MAX_NAME_BYTES = 48;
const MAX_CUTS = 200;
const MODES: readonly ChallengeMode[] = ['daily', 'survival'];

/**
 * Names are shown to strangers ("Sam challenged you"), so only letters, digits,
 * spaces and ' - _ are allowed. No dots, slashes or colons means no URLs in
 * link previews.
 */
export function sanitiseName(raw: string): string {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} '’_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_NAME_CHARS).join('').trim();
}

function utf8Truncated(name: string): Uint8Array {
  const enc = new TextEncoder();
  let chars = Array.from(name);
  let bytes = enc.encode(name);
  while (bytes.length > MAX_NAME_BYTES && chars.length > 0) {
    chars = chars.slice(0, -1);
    bytes = enc.encode(chars.join(''));
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function encodeChallenge(data: ChallengeData): string {
  const name = utf8Truncated(sanitiseName(data.name));
  const cuts = data.cuts.slice(0, MAX_CUTS);
  const size = 1 + 1 + 4 + 4 + 2 + 1 + name.length + 1 + cuts.length * 4;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  let o = 0;
  view.setUint8(o, VERSION);
  o += 1;
  view.setUint8(o, MODES.indexOf(data.mode));
  o += 1;
  view.setUint32(o, data.seed >>> 0);
  o += 4;
  view.setUint32(o, data.sharerId >>> 0);
  o += 4;
  view.setUint16(o, Math.max(0, Math.min(0xffff, Math.round(data.score))));
  o += 2;
  view.setUint8(o, name.length);
  o += 1;
  buf.set(name, o);
  o += name.length;
  view.setUint8(o, cuts.length);
  o += 1;
  for (const [a, off] of cuts) {
    view.setUint16(o, a & 0xffff);
    view.setUint16(o + 2, off & 0xffff);
    o += 4;
  }
  return toBase64Url(buf);
}

export function decodeChallenge(code: string): ChallengeData | null {
  if (code.length === 0 || code.length > 1200) return null;
  const buf = fromBase64Url(code);
  if (!buf || buf.length < 14) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  if (view.getUint8(o) !== VERSION) return null;
  o += 1;
  const mode = MODES[view.getUint8(o)];
  o += 1;
  if (!mode) return null;
  const seed = view.getUint32(o);
  o += 4;
  const sharerId = view.getUint32(o);
  o += 4;
  const score = view.getUint16(o);
  o += 2;
  const nameLen = view.getUint8(o);
  o += 1;
  if (nameLen > MAX_NAME_BYTES || o + nameLen + 1 > buf.length) return null;
  let name: string;
  try {
    name = sanitiseName(new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(o, o + nameLen)));
  } catch {
    return null;
  }
  o += nameLen;
  const cutCount = view.getUint8(o);
  o += 1;
  if (cutCount === 0 || cutCount > MAX_CUTS || o + cutCount * 4 !== buf.length) return null;
  const cuts: [number, number][] = [];
  for (let i = 0; i < cutCount; i++) {
    cuts.push([view.getUint16(o), view.getUint16(o + 2)]);
    o += 4;
  }
  if (mode === 'daily' && (seed < 1 || cutCount !== 5)) return null;
  return { mode, seed, sharerId, score, name, cuts };
}
