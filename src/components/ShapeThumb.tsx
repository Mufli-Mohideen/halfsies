import { useEffect, useRef } from 'react';
import type { Line } from '../game/geometry';
import type { Round } from '../game/run';
import { displayPercent, smallerShare, toneFor } from '../game/scoring';
import { drawCutThumbnail } from '../render/draw';

interface ShapeThumbProps {
  round: Round;
  rival?: Line | null;
  size?: number;
}

export function ShapeThumb({ round, rival = null, size = 60 }: ShapeThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawCutThumbnail(ctx, round.shape.points, { x: 0, y: 0, size }, round.line, rival);
  }, [round, rival, size]);

  const share = displayPercent(smallerShare(round.score));
  return (
    <figure className={`thumb tone-${toneFor(round.score.grade)}`}>
      <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />
      <figcaption>
        <span className="sr-only">{round.shape.name}: </span>
        {share}
      </figcaption>
    </figure>
  );
}
