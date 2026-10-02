import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface CountUp {
  to: number;
  from?: number;
  /** Restarts the animation when it changes. */
  key: unknown;
  duration: number;
  /** Call `onStep` each time the value crosses a multiple of this (drives the tick sound). */
  step?: number;
  onStep?: () => void;
}

/** Ticks closer together than this blur into a buzz; skip them. */
const MIN_TICK_GAP_MS = 45;

/** Eases from `from` to `to` (quart-out: fast start, settles like a needle). */
export function useCountUp({ to, from = 0, key, duration, step = 1, onStep }: CountUp): number {
  const [value, setValue] = useState(from);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      setValue(to);
      return;
    }
    let raf = 0;
    let lastBucket = Math.floor(from / step);
    let lastTick = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = from + (to - from) * (1 - Math.pow(1 - t, 4));
      const bucket = Math.floor(v / step);
      if (bucket !== lastBucket && now - lastTick > MIN_TICK_GAP_MS) {
        lastBucket = bucket;
        lastTick = now;
        stepRef.current?.();
      }
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    setValue(from);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, from, key, duration, step]);

  return value;
}
