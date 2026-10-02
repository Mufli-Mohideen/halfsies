import { normalOf, type Line, type Polygon } from '../game/geometry';

/** Single source of truth for the palette; mirrored as CSS custom properties in styles.css. */
export const PALETTE = {
  mat: '#1d473c',
  matDeep: '#163a31',
  grid: 'rgba(233, 240, 226, 0.055)',
  gridMajor: 'rgba(233, 240, 226, 0.11)',
  paper: '#f4eedf',
  red: '#ff5a36',
  ink: '#121a17',
} as const;

export interface View {
  cx: number;
  cy: number;
  /** Pixels per local unit. */
  scale: number;
  rotation: number;
}

export function tracePolygon(ctx: CanvasRenderingContext2D, poly: Polygon): void {
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** Clips the context (in local coordinates) to one side of the line. */
function clipSide(ctx: CanvasRenderingContext2D, line: Line, side: 'A' | 'B'): void {
  const n = normalOf(line);
  const d = { x: -n.y, y: n.x };
  const p0 = { x: n.x * line.offset, y: n.y * line.offset };
  const far = 20;
  const s = side === 'A' ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(p0.x + d.x * far, p0.y + d.y * far);
  ctx.lineTo(p0.x - d.x * far, p0.y - d.y * far);
  ctx.lineTo(p0.x - d.x * far + n.x * far * s, p0.y - d.y * far + n.y * far * s);
  ctx.lineTo(p0.x + d.x * far + n.x * far * s, p0.y + d.y * far + n.y * far * s);
  ctx.closePath();
  ctx.clip();
}

export function applyView(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.translate(view.cx, view.cy);
  ctx.rotate(view.rotation);
  ctx.scale(view.scale, view.scale);
}

interface PieceStyle {
  fillA: string;
  fillB: string;
  /** Screen pixels each piece is pushed away from the cut. */
  separation: number;
  shadow: boolean;
}

const DEFAULT_PIECES: PieceStyle = {
  fillA: PALETTE.paper,
  fillB: PALETTE.red,
  separation: 0,
  shadow: true,
};

function fillShape(ctx: CanvasRenderingContext2D, poly: Polygon, fill: string, scale: number, shadow: boolean): void {
  if (shadow) {
    ctx.save();
    ctx.translate(2 / scale, 5 / scale);
    tracePolygon(ctx, poly);
    ctx.fillStyle = 'rgba(8, 22, 18, 0.35)';
    ctx.fill();
    ctx.restore();
  }
  tracePolygon(ctx, poly);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draws the shape whole (line = null) or as two coloured pieces split by the line. */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  poly: Polygon,
  view: View,
  line: Line | null,
  style: Partial<PieceStyle> = {},
): void {
  const s = { ...DEFAULT_PIECES, ...style };
  ctx.save();
  applyView(ctx, view);
  if (!line) {
    fillShape(ctx, poly, s.fillA, view.scale, s.shadow);
    ctx.restore();
    return;
  }
  const n = normalOf(line);
  const push = s.separation / view.scale;
  for (const side of ['A', 'B'] as const) {
    const dir = side === 'A' ? -1 : 1;
    ctx.save();
    ctx.translate(n.x * push * dir, n.y * push * dir);
    clipSide(ctx, line, side);
    fillShape(ctx, poly, side === 'A' ? s.fillA : s.fillB, view.scale, s.shadow);
    ctx.restore();
  }
  ctx.restore();
}

/** Endpoints of a local-space line, extended far beyond the shape, mapped to screen space. */
export function lineToScreen(line: Line, view: View, reach = 4): [{ x: number; y: number }, { x: number; y: number }] {
  const n = normalOf(line);
  const d = { x: -n.y, y: n.x };
  const p0 = { x: n.x * line.offset, y: n.y * line.offset };
  const map = (x: number, y: number) => {
    const c = Math.cos(view.rotation);
    const sn = Math.sin(view.rotation);
    return { x: view.cx + (x * c - y * sn) * view.scale, y: view.cy + (x * sn + y * c) * view.scale };
  };
  return [map(p0.x - d.x * reach, p0.y - d.y * reach), map(p0.x + d.x * reach, p0.y + d.y * reach)];
}

export function strokeLine(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width: number,
  dash: number[] = [],
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

export function drawMatGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cell: number): void {
  ctx.fillStyle = PALETTE.mat;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = 1;
  for (let i = 0, x = 0; x <= w; i++, x += cell) {
    ctx.strokeStyle = i % 5 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let i = 0, y = 0; y <= h; i++, y += cell) {
    ctx.strokeStyle = i % 5 === 0 ? PALETTE.gridMajor : PALETTE.grid;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
}

/** Shared by the results thumbnails and the share image: shape, your cut, optional rival cut. */
export function drawCutThumbnail(
  ctx: CanvasRenderingContext2D,
  poly: Polygon,
  box: { x: number; y: number; size: number },
  line: Line,
  rival?: Line | null,
): void {
  const view: View = { cx: box.x + box.size / 2, cy: box.y + box.size / 2, scale: box.size * 0.42, rotation: 0 };
  drawShape(ctx, poly, view, line, { separation: Math.max(1.5, box.size * 0.018), shadow: false });
  if (rival) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.size, box.size);
    ctx.clip();
    const [a, b] = lineToScreen(rival, view);
    strokeLine(ctx, a, b, PALETTE.paper, Math.max(1, box.size * 0.012), [box.size * 0.04, box.size * 0.03]);
    ctx.restore();
  }
}
