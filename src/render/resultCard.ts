import { displayName, runScore, type HeadToHead, type Round, type RunSpec } from '../game/run';
import { displayPercent, rankFor, smallerShare } from '../game/scoring';
import { formatDay } from '../lib/daily';
import { drawCutThumbnail, drawMatGrid, PALETTE } from './draw';

const W = 1080;
const H = 1350;
const PAD = 80;
const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const MUTED = 'rgba(244, 238, 223, 0.74)';

interface CardInput {
  spec: RunSpec;
  rounds: readonly Round[];
  rival?: { name: string; rounds: readonly Round[]; result: HeadToHead } | null;
  host: string;
}

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`800 72px ${SANS}`), document.fonts.load(`500 28px ${MONO}`)]);
  } catch {
    // Falls back to system fonts; the card still renders.
  }
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', tracking = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = `${tracking}px`;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = '0px';
}

/** The wordmark as the CSS draws it: "half" in paper, "sies" in vermilion nudged along the cut. */
function wordmark(ctx: CanvasRenderingContext2D, x: number, baseline: number, size: number) {
  const font = `800 ${size}px ${SANS}`;
  const tracking = -0.05 * size;
  ctx.font = font;
  ctx.letterSpacing = `${tracking}px`;
  const halfWidth = ctx.measureText('half').width;
  ctx.letterSpacing = '0px';
  text(ctx, 'half', x, baseline, font, PALETTE.paper, 'left', tracking);
  text(ctx, 'sies', x + halfWidth + size * 0.035, baseline + size * 0.05, font, PALETTE.red, 'left', tracking);
}

/** A portrait (4:5) PNG for Instagram/TikTok stories and group chats. */
export async function renderResultCard({ spec, rounds, rival, host }: CardInput): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  drawMatGrid(ctx, W, H, 36);
  ctx.textBaseline = 'alphabetic';

  wordmark(ctx, PAD, 150, 76);
  const kicker = spec.mode === 'daily' ? `#${spec.seed} · ${formatDay(spec.seed)}` : 'Sudden death';
  text(ctx, kicker, W - PAD, 138, `500 30px ${MONO}`, MUTED, 'right');

  const score = runScore(spec.mode, rounds);
  const scoreFont = `750 330px ${SANS}`;
  text(ctx, String(score), PAD - 12, 560, scoreFont, PALETTE.paper, 'left', -18);
  ctx.font = scoreFont;
  ctx.letterSpacing = '-18px';
  const scoreWidth = ctx.measureText(String(score)).width;
  ctx.letterSpacing = '0px';
  const unit = spec.mode === 'daily' ? '/500' : score === 1 ? 'cut' : 'cuts';
  text(ctx, unit, PAD + scoreWidth + 8, 560, `700 88px ${SANS}`, PALETTE.red, 'left', -2);

  let sub: string;
  if (rival) {
    const verb = rival.result.outcome === 'win' ? 'Beat' : rival.result.outcome === 'loss' ? 'Lost to' : 'Tied with';
    sub = `${verb} ${displayName(rival.name)}, ${rival.result.you} to ${rival.result.them}`;
  } else {
    sub = spec.mode === 'daily' ? rankFor(score) : 'in Sudden Death';
  }
  text(ctx, sub, PAD, 660, `700 56px ${SANS}`, PALETTE.paper, 'left', -1);

  const shown = rounds.slice(-10);
  const perRow = 5;
  const gap = 20;
  const size = (W - PAD * 2 - gap * (perRow - 1)) / perRow;
  const top = shown.length > perRow ? 740 : 790;
  shown.forEach((round, i) => {
    const x = PAD + (i % perRow) * (size + gap);
    const y = top + Math.floor(i / perRow) * (size + 64);
    ctx.fillStyle = PALETTE.matDeep;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 10);
    ctx.fill();
    const rivalLine = rival?.rounds[rounds.length - shown.length + i]?.line ?? null;
    drawCutThumbnail(ctx, round.shape.points, { x, y, size }, round.line, rivalLine);
    text(ctx, displayPercent(smallerShare(round.score)), x + size / 2, y + size + 42, `500 28px ${MONO}`, MUTED, 'center');
  });

  text(ctx, 'Your turn.', PAD, H - 150, `750 64px ${SANS}`, PALETTE.paper, 'left', -1.5);
  text(ctx, host, PAD, H - 92, `500 30px ${MONO}`, PALETTE.red);
  text(ctx, 'A game by NVYLO', W - PAD, H - 92, `500 24px ${MONO}`, MUTED, 'right');

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), 'image/png');
  });
}
