import { quantiseLine } from '../game/geometry';
import { displayName, runScore, type HeadToHead, type Round, type RunSpec } from '../game/run';
import { GRADE_EMOJI } from '../game/scoring';
import { encodeChallenge } from './challengeCodec';

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

export interface ShareMessage {
  /** The challenge, without the link (some targets take the URL separately). */
  text: string;
  url: string;
}

export function challengeUrl(spec: RunSpec, rounds: readonly Round[], name: string, sharerId: number): string {
  const code = encodeChallenge({
    mode: spec.mode,
    seed: spec.seed,
    sharerId,
    score: runScore(spec.mode, rounds),
    name,
    cuts: rounds.map((r) => quantiseLine(r.line)),
  });
  // location.origin keeps links working on preview deploys and localhost too.
  return `${window.location.origin}/c/${code}`;
}

export function emojiRow(rounds: readonly Round[], max = 12): string {
  return rounds
    .slice(-max)
    .map((r) => GRADE_EMOJI[r.score.grade])
    .join('');
}

interface MessageInput {
  spec: RunSpec;
  rounds: readonly Round[];
  url: string;
  rival?: { name: string; result: HeadToHead } | null;
}

/** Reads like something a person would send, not an ad: the result, the proof, the dare. */
export function shareMessage({ spec, rounds, url, rival }: MessageInput): ShareMessage {
  const head = spec.mode === 'daily' ? `Halfsies #${spec.seed}` : 'Halfsies Sudden Death';
  const unit = (n: number) => (spec.mode === 'daily' ? String(n) : `${n} ${n === 1 ? 'cut' : 'cuts'}`);
  const row = emojiRow(rounds);
  let line: string;
  let dare: string;
  if (rival) {
    const who = displayName(rival.name);
    const { you, them, outcome } = rival.result;
    if (outcome === 'win') {
      line = `I beat ${who}, ${unit(you)} to ${unit(them)}`;
      dare = 'Your move.';
    } else if (outcome === 'loss') {
      line = `${who} beat me, ${unit(them)} to ${unit(you)}`;
      dare = 'Rematch?';
    } else {
      line = `${who} and I tied at ${unit(you)}`;
      dare = 'Tiebreaker?';
    }
  } else {
    const score = runScore(spec.mode, rounds);
    line = spec.mode === 'daily' ? `${score}/500` : unit(score);
    dare = 'Beat that.';
  }
  return { text: `${head} · ${line}\n${row}\n${dare}`, url };
}

export const fullText = (m: ShareMessage) => `${m.text}\n${m.url}`;

export function shareTargets(m: ShareMessage) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(fullText(m))}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(m.text)}&url=${encodeURIComponent(m.url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(m.url)}`,
  };
}

export function canShareNatively(): boolean {
  return typeof navigator.share === 'function';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews (in-app browsers) without async clipboard.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** System share sheet (WhatsApp, iMessage, Instagram…), falling back to the clipboard. */
export async function shareNatively(m: ShareMessage): Promise<ShareOutcome> {
  if (canShareNatively()) {
    try {
      await navigator.share({ text: m.text, url: m.url });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  return (await copyText(fullText(m))) ? 'copied' : 'failed';
}

export async function shareImage(blob: Blob, m: ShareMessage, filename: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: fullText(m) });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
