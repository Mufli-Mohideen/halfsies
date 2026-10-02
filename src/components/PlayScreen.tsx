import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Line } from '../game/geometry';
import {
  displayName,
  isRunOver,
  runScore,
  scoreRounds,
  ShapeSequence,
  survivedCount,
  totalPoints,
  type Opponent,
  type Round,
  type RunSpec,
} from '../game/run';
import { displayPercent, scoreCut, survives, toneFor, type Grade } from '../game/scoring';
import { DAILY_ROUNDS } from '../game/shapes';
import { track } from '../lib/analytics';
import { sound, vibrate, type SoundName } from '../lib/sound';
import { Board, type Ghost } from './Board';
import { AimHeadline, RevealHeadline } from './RoundHeadline';
import { GHOST_AUTO_ADVANCE, REVEAL } from './timing';

export type FinishAction = 'result' | 'retry';

interface PlayScreenProps {
  spec: RunSpec;
  opponent: Opponent | null;
  /** Cuts already made in this run (resuming today's daily after a reload). */
  resume: readonly Line[];
  firstTime: boolean;
  survivalBest: number;
  onProgress: (rounds: Round[]) => void;
  onFinish: (rounds: Round[], action: FinishAction) => void;
}

const SOUND_FOR: Record<Grade, SoundName> = {
  perfect: 'perfect',
  surgical: 'good',
  clean: 'good',
  close: 'meh',
  off: 'bad',
  butchered: 'bad',
};

// After going out, only the buttons act: a stray tap shouldn't start a new run.
const noop = () => undefined;

export function PlayScreen({ spec, opponent, resume, firstTime, survivalBest, onProgress, onFinish }: PlayScreenProps) {
  const sequence = useMemo(() => new ShapeSequence(spec), [spec]);
  const rivalRounds = useMemo(() => (opponent ? scoreRounds(sequence, opponent.cuts) : null), [opponent, sequence]);
  const [rounds, setRounds] = useState<Round[]>(() => scoreRounds(sequence, resume));
  const [revealing, setRevealing] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [missed, setMissed] = useState(0);
  const [bOnLeft, setBOnLeft] = useState(false);
  const finished = useRef(false);
  const timing = REVEAL[spec.mode];

  const index = revealing ? rounds.length - 1 : rounds.length;
  const shape = sequence.at(index);
  const current = revealing ? rounds[index]! : null;
  const over = revealing && isRunOver(spec, rounds);
  const failedOut = over && spec.mode === 'survival';
  const isNewBest = (list: Round[]) => spec.mode === 'survival' && survivalBest > 0 && survivedCount(list) === survivalBest + 1;
  const newBest = revealing && !over && isNewBest(rounds);

  useEffect(() => {
    track('game_started', { mode: spec.mode, challenge: opponent !== null, resumed: resume.length > 0 });
  }, [spec, opponent, resume.length]);

  const finish = useCallback(
    (action: FinishAction) => {
      if (finished.current) return; // double taps, Enter + click
      finished.current = true;
      onFinish(rounds, action);
    },
    [rounds, onFinish],
  );

  const handleCut = useCallback(
    (line: Line, redOnLeft: boolean) => {
      const round: Round = { shape, line, score: scoreCut(shape.points, line) };
      const next = [...rounds, round];
      const out = spec.mode === 'survival' && !survives(round.score.deviation, index);
      setRounds(next);
      setRevealing(true);
      setAiming(false);
      setMissed(0);
      setBOnLeft(redOnLeft);
      onProgress(next);
      sound.play('cut');
      vibrate(round.score.grade === 'perfect' ? [12, 50, 12, 50, 24] : 10);
      let reaction = SOUND_FOR[round.score.grade];
      if (out) reaction = 'out';
      else if (isNewBest(next)) reaction = 'best';
      window.setTimeout(() => sound.play(reaction), timing.settle);
      track('round_cut', { mode: spec.mode, round: index, kind: shape.kind, deviation: round.score.deviation });
    },
    // isNewBest only reads spec/survivalBest, already listed.
    [rounds, shape, spec.mode, index, onProgress, survivalBest, timing.settle],
  );

  const handleContinue = useCallback(() => {
    if (!revealing) return;
    if (isRunOver(spec, rounds)) {
      finish('result');
      return;
    }
    sound.play('next');
    setRevealing(false);
  }, [revealing, rounds, spec, finish]);

  const retry = useCallback(() => finish('retry'), [finish]);

  // Keyboard: Enter/Space continues (or retries, after going out).
  useEffect(() => {
    if (!revealing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if ((e.target as HTMLElement | null)?.closest('button, input, a')) return; // the focused control acts itself
      e.preventDefault();
      if (failedOut) retry();
      else handleContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealing, failedOut, handleContinue, retry]);

  const rivalRound = rivalRounds?.[index];
  const rivalOutAt = spec.mode === 'survival' && rivalRounds ? survivedCount(rivalRounds) : null;

  // Sudden Death keeps its rhythm: survive, beat, next shape.
  let autoAdvance: number | null = timing.autoAdvance;
  if (autoAdvance !== null && rivalRound) autoAdvance = GHOST_AUTO_ADVANCE;
  useEffect(() => {
    if (!revealing || over || autoAdvance === null) return;
    const id = window.setTimeout(handleContinue, timing.settle + autoAdvance);
    return () => window.clearTimeout(id);
  }, [revealing, over, autoAdvance, handleContinue, timing.settle]);

  const ghost: Ghost | null =
    opponent && rivalRound ? { line: rivalRound.line, label: `${displayName(opponent.name)} ${displayPercent(rivalRound.score.percentA)}` } : null;

  const rival =
    opponent && rivalRounds
      ? { name: opponent.name, score: runScore(spec.mode, rivalRounds), totalSoFar: totalPoints(rivalRounds.slice(0, index)) }
      : null;

  let footer;
  if (failedOut) {
    footer = (
      <div className="footer-pair">
        <button className="btn btn-primary" onClick={retry}>
          Try again
        </button>
        <button className="btn btn-secondary" onClick={() => finish('result')}>
          Result
        </button>
      </div>
    );
  } else if (revealing) {
    const timed = autoAdvance !== null && !over;
    footer = (
      <button
        className={`btn btn-primary btn-wide ${timed ? 'btn-timer' : ''}`}
        style={timed ? ({ '--timer': `${timing.settle + autoAdvance!}ms` } as CSSProperties) : undefined}
        onClick={handleContinue}
      >
        {over ? 'See result' : 'Next shape'}
        <span aria-hidden>→</span>
      </button>
    );
  } else {
    footer = (
      <p className={`hint ${missed > 0 ? 'hint-warn' : ''}`} key={missed}>
        {missed > 0 ? (
          <>
            <span className="hint-touch">Swipe all the way through the shape</span>
            <span className="hint-pointer">Drag all the way through the shape</span>
          </>
        ) : (
          <>
            <span className="hint-touch">Swipe across the shape to cut</span>
            <span className="hint-pointer">Drag across the shape to cut, or use the arrow keys</span>
          </>
        )}
      </p>
    );
  }

  return (
    <main className="play">
      <Progress spec={spec} rounds={rounds} index={index} best={survivalBest} rivalOutAt={rivalOutAt} rivalName={opponent?.name ?? null} />
      {current ? (
        <RevealHeadline
          spec={spec}
          index={index}
          round={current}
          rival={opponent ? { name: opponent.name, round: rivalRound, outAt: rivalOutAt } : null}
          newBest={newBest}
          redOnLeft={bOnLeft}
        />
      ) : (
        <AimHeadline spec={spec} index={index} shape={shape} firstTime={firstTime} total={totalPoints(rounds)} rival={rival} />
      )}
      <Board
        shape={shape}
        cut={current?.line ?? null}
        grade={current?.score.grade ?? null}
        ghost={ghost}
        showHint={firstTime && index === 0 && !aiming && missed === 0}
        continueAfter={timing.continueAfter}
        onAimStart={() => setAiming(true)}
        onCut={handleCut}
        onMiss={() => {
          setMissed((m) => m + 1);
          setAiming(false);
        }}
        onContinue={failedOut ? noop : handleContinue}
      />
      <footer className="play-footer">{footer}</footer>
    </main>
  );
}

interface ProgressProps {
  spec: RunSpec;
  rounds: Round[];
  index: number;
  best: number;
  rivalOutAt: number | null;
  rivalName: string | null;
}

function Progress({ spec, rounds, index, best, rivalOutAt, rivalName }: ProgressProps) {
  if (spec.mode === 'survival') {
    const survived = survivedCount(rounds);
    let target = null;
    if (rivalOutAt !== null && rivalName !== null) {
      target = (
        <span className={survived > rivalOutAt ? 'is-ahead' : ''}>
          {displayName(rivalName)} <strong>{rivalOutAt}</strong>
        </span>
      );
    } else if (best > 0) {
      target = (
        <span className={survived > best ? 'is-ahead' : ''}>
          Best <strong>{Math.max(best, survived)}</strong>
        </span>
      );
    }
    return (
      <p className="progress progress-count">
        <span>
          <strong>{survived}</strong> survived
        </span>
        {target}
      </p>
    );
  }
  return (
    <ol className="progress" aria-label={`Shape ${index + 1} of ${DAILY_ROUNDS}`}>
      {Array.from({ length: DAILY_ROUNDS }, (_, i) => {
        const r = rounds[i];
        let state = '';
        if (r) state = `is-done tone-${toneFor(r.score.grade)}`;
        else if (i === index) state = 'is-current';
        return <li key={i} className={`dot ${state}`} />;
      })}
    </ol>
  );
}
