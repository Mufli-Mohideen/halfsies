import { displayName, type Round, type RunSpec } from '../game/run';
import { displayPercent, gradeLabel, survivalTolerance, survives, toneFor } from '../game/scoring';
import { DAILY_ROUNDS, type Shape } from '../game/shapes';
import { sound } from '../lib/sound';
import { REVEAL } from './timing';
import { useCountUp } from './useCountUp';

interface AimProps {
  spec: RunSpec;
  index: number;
  shape: Shape;
  firstTime: boolean;
  /** Points so far in this run (daily only). */
  total: number;
  rival: { name: string; score: number; totalSoFar: number } | null;
}

/** Before the cut: what to do, and what's at stake. */
export function AimHeadline({ spec, index, shape, firstTime, total, rival }: AimProps) {
  const spins = shape.spin !== 0;
  let label: string;
  let title: string;
  let body: string;

  if (rival && index === 0) {
    const target = spec.mode === 'daily' ? `${rival.score}/500` : `${rival.score} ${rival.score === 1 ? 'cut' : 'cuts'}`;
    label = spec.mode === 'daily' ? `Challenge · #${spec.seed}` : 'Challenge · Sudden death';
    title = `${displayName(rival.name)} challenged you`;
    body = `Beat ${target} on the same shapes.`;
  } else if (spec.mode === 'survival') {
    const tol = survivalTolerance(index);
    label = `Sudden death · Cut ${index + 1}`;
    title = shape.name;
    body = `Stay between ${displayPercent(50 - tol)} and ${displayPercent(50 + tol)}.${spins ? ' It spins.' : ''}`;
  } else {
    label = `#${spec.seed} · Shape ${index + 1} of ${DAILY_ROUNDS}`;
    if (firstTime && index === 0) {
      title = 'Cut it exactly in half.';
      body = 'One swipe. The closer to 50/50, the better.';
    } else {
      title = shape.name;
      const standing = rival ? `You ${total} · ${displayName(rival.name)} ${rival.totalSoFar}` : `${total} points so far`;
      body = spins ? `It spins. Time your cut. ${standing}` : standing;
    }
  }

  return (
    <div className="headline">
      <p className={`t-label ${rival && index === 0 ? 't-label-accent' : ''}`}>{label}</p>
      <h1 className="t-title">{title}</h1>
      <p className="t-body">{body}</p>
    </div>
  );
}

interface RevealProps {
  spec: RunSpec;
  index: number;
  round: Round;
  /** In Sudden Death, the cut index the rival went out on (null in daily). */
  rival: { name: string; round: Round | undefined; outAt: number | null } | null;
  newBest: boolean;
  /** Matches the board: when the red piece landed on the left, its number goes on the left. */
  redOnLeft: boolean;
}

function revealNote({ spec, index, round, rival, newBest }: RevealProps, failed: boolean): string {
  const { grade, deviation } = round.score;
  if (rival) {
    const who = displayName(rival.name);
    if (rival.outAt !== null && index === rival.outAt && !failed) return `You outlasted ${who}.`;
    if (rival.round) {
      const theirs = rival.round.score;
      let verdict = 'tie';
      if (deviation < theirs.deviation) verdict = 'you take it';
      else if (deviation > theirs.deviation) verdict = 'they take it';
      return `${who} ${displayPercent(theirs.percentA)} / ${displayPercent(100 - theirs.percentA)} · ${verdict}`;
    }
  }
  if (failed) {
    const tolerance = survivalTolerance(index);
    const by = Math.round((deviation - tolerance) * 10) / 10;
    return by <= 1 ? `So close. Out by ${by.toFixed(1)}.` : `Needed ${displayPercent(50 - tolerance)} or better.`;
  }
  if (newBest && spec.mode === 'survival') return 'New best.';
  if (grade === 'perfect') return 'Exactly half.';
  if (deviation < 0.5) return `${deviation.toFixed(1)} from perfect.`;
  return '';
}

/** After the cut: the numbers count in, then the verdict lands. */
export function RevealHeadline(props: RevealProps) {
  const { spec, index, round } = props;
  // The readout starts at a perfect 50/50 and drifts to the truth, like a needle settling:
  // the distance it travels *is* the miss, and a perfect cut never moves.
  const a = useCountUp({ from: 50, to: round.score.percentA, key: round, duration: REVEAL[spec.mode].settle, step: 0.5, onStep: () => sound.play('tick') });
  const settled = Math.abs(a - round.score.percentA) < 0.001;
  const failed = spec.mode === 'survival' && !survives(round.score.deviation, index);
  const tone = failed ? 'bad' : toneFor(round.score.grade);
  const note = revealNote(props, failed);

  return (
    <div className="headline headline-reveal">
      <p className="split" aria-hidden>
        <span className={`split-left ${props.redOnLeft ? 'is-red' : ''}`}>{displayPercent(props.redOnLeft ? 100 - a : a)}</span>
        <span className="split-cut" />
        <span className={`split-right ${props.redOnLeft ? '' : 'is-red'}`}>{displayPercent(props.redOnLeft ? a : 100 - a)}</span>
      </p>
      <div className={`reveal-detail ${settled ? 'is-in' : ''}`} aria-live="polite">
        <p className={`verdict tone-${tone} ${failed ? 'is-out' : ''}`}>
          <span className="verdict-label">{failed ? 'Out' : gradeLabel(round.score)}</span>
          {spec.mode === 'daily' && <span className="verdict-points">+{round.score.points}</span>}
          <span className="sr-only">
            {displayPercent(round.score.percentA)} and {displayPercent(100 - round.score.percentA)} percent.
          </span>
        </p>
        <p className="t-body">{note || ' '}</p>
      </div>
    </div>
  );
}
