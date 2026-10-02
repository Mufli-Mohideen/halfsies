import { useCallback, useEffect, useMemo, useState } from 'react';
import { compare, displayName, runScore, scoreRounds, ShapeSequence, type Opponent, type Round, type RunSpec } from '../game/run';
import { rankFor } from '../game/scoring';
import { track } from '../lib/analytics';
import { formatCountdown, formatDay, msUntilNextDay } from '../lib/daily';
import { challengeUrl, shareImage, shareMessage } from '../lib/share';
import { sound } from '../lib/sound';
import type { DailyStats } from '../lib/storage';
import { renderResultCard } from '../render/resultCard';
import { ShapeThumb } from './ShapeThumb';
import { ShareSheet } from './ShareSheet';
import { StudioCredit } from './StudioCredit';
import { useCountUp } from './useCountUp';

interface ResultScreenProps {
  spec: RunSpec;
  rounds: Round[];
  opponent: Opponent | null;
  today: number;
  name: string;
  playerId: number;
  stats: DailyStats;
  survivalBest: number;
  isNewBest: boolean;
  todayPlayed: boolean;
  onNameChange: (name: string) => void;
  onPlaySurvival: () => void;
  onPlayToday: () => void;
  onNewDay: () => void;
  notify: (message: string) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const HERO_COUNT_MS = 640;

export function ResultScreen(props: ResultScreenProps) {
  const { spec, rounds, opponent, today, name, playerId, stats, notify } = props;
  const [sharing, setSharing] = useState(false);
  const isDaily = spec.mode === 'daily';

  const rival = useMemo(() => {
    if (!opponent) return null;
    const theirRounds = scoreRounds(new ShapeSequence(spec), opponent.cuts);
    return { name: opponent.name, rounds: theirRounds, result: compare(spec.mode, rounds, theirRounds) };
  }, [opponent, spec, rounds]);

  // The score lands like a total being added up; the chime waits for it.
  const score = runScore(spec.mode, rounds);
  const shownScore = Math.round(useCountUp({ to: rival ? rival.result.you : score, key: rounds, duration: HERO_COUNT_MS }));
  const shownThem = Math.round(useCountUp({ to: rival?.result.them ?? 0, key: rounds, duration: HERO_COUNT_MS }));
  useEffect(() => {
    if (rival?.result.outcome !== 'win' && !props.isNewBest) return;
    const id = window.setTimeout(() => sound.play('best'), HERO_COUNT_MS);
    return () => window.clearTimeout(id);
  }, [rival, props.isNewBest]);

  const message = useMemo(
    () => shareMessage({ spec, rounds, rival, url: challengeUrl(spec, rounds, name, playerId) }),
    [spec, rounds, rival, name, playerId],
  );

  const saveImage = useCallback(async () => {
    const blob = await renderResultCard({ spec, rounds, rival, host: window.location.host });
    return shareImage(blob, message, `halfsies-${isDaily ? spec.seed : 'sudden-death'}.png`);
  }, [spec, rounds, rival, message, isDaily]);

  const openShare = () => {
    track('share_clicked', { mode: spec.mode, rematch: rival !== null });
    setSharing(true);
  };

  const kicker = isDaily ? `#${spec.seed} · ${formatDay(spec.seed)}` : 'Sudden death';

  let subline: string;
  if (isDaily) subline = props.isNewBest ? `${rankFor(score)} · Personal best` : rankFor(score);
  else if (props.isNewBest && score > 0) subline = 'New best';
  else subline = `Best ${props.survivalBest}`;

  const shareButton = (
    <button className={`btn ${isDaily ? 'btn-primary' : 'btn-secondary'} btn-wide`} onClick={openShare}>
      {rival ? 'Send it back' : 'Challenge a friend'}
      <span aria-hidden>→</span>
    </button>
  );

  return (
    <main className="result">
      <h1 className="t-label">{kicker}</h1>

      {rival ? (
        <Versus {...rival.result} shownYou={shownScore} shownThem={shownThem} name={rival.name} daily={isDaily} />
      ) : (
        <div className="hero">
          <p className="hero-score" aria-label={`${score} ${isDaily ? 'out of 500' : 'cuts'}`}>
            {shownScore}
            <span className="hero-unit">{isDaily ? '/500' : score === 1 ? ' cut' : ' cuts'}</span>
          </p>
          <p className="hero-sub">{subline}</p>
        </div>
      )}

      <div className="thumbs">
        {rounds.map((r, i) => (
          <ShapeThumb key={i} round={r} rival={rival?.rounds[i]?.line ?? null} size={rounds.length > 5 ? 48 : 56} />
        ))}
      </div>
      {rival && <p className="t-caption">Dashed line: {displayName(rival.name)}’s cut</p>}
      {isDaily && !rival && stats.played > 1 && (
        <p className="t-caption">
          {plural(stats.streak, 'day', 'days')} streak · average {stats.average}
        </p>
      )}

      <div className="actions">
        {isDaily ? (
          shareButton
        ) : (
          <>
            <button className="btn btn-primary btn-wide" onClick={props.onPlaySurvival}>
              Try again
            </button>
            {shareButton}
          </>
        )}
      </div>

      <section className="next" aria-label="What’s next">
        {isDaily && (!props.todayPlayed && spec.seed !== today ? (
          <button className="btn btn-primary btn-wide" onClick={props.onPlayToday}>
            Play today’s Halfsies #{today}
          </button>
        ) : (
          <Countdown onDone={props.onNewDay} />
        ))}
        {isDaily ? (
          <button className="btn btn-secondary btn-wide" onClick={props.onPlaySurvival}>
            Play Sudden Death
            <span className="btn-note">Endless. One lopsided cut and you’re out.</span>
          </button>
        ) : (
          !props.todayPlayed && (
            <button className="btn btn-ghost btn-wide" onClick={props.onPlayToday}>
              Play today’s Halfsies #{today}
            </button>
          )
        )}
      </section>

      <StudioCredit />

      {sharing && (
        <ShareSheet
          message={message}
          name={name}
          mode={spec.mode}
          onNameChange={props.onNameChange}
          onSaveImage={saveImage}
          onClose={() => setSharing(false)}
          notify={notify}
        />
      )}
    </main>
  );
}

interface VersusProps {
  you: number;
  shownYou: number;
  shownThem: number;
  them: number;
  roundsWon: number;
  roundsLost: number;
  outcome: 'win' | 'loss' | 'draw';
  name: string;
  daily: boolean;
}

function Versus({ you, them, shownYou, shownThem, name, outcome, daily, roundsWon, roundsLost }: VersusProps) {
  const who = displayName(name);
  const title = outcome === 'win' ? 'You win.' : outcome === 'loss' ? `${who} wins.` : 'Dead even.';
  return (
    <div className={`versus versus-${outcome}`}>
      <p className="versus-title">{title}</p>
      <div className="versus-scores">
        <div>
          <span className="versus-num" aria-label={String(you)}>{shownYou}</span>
          <span className="t-caption">You</span>
        </div>
        <span className="versus-vs" aria-hidden />
        <div>
          <span className="versus-num versus-num-them" aria-label={String(them)}>{shownThem}</span>
          <span className="t-caption versus-who">{who}</span>
        </div>
      </div>
      <p className="t-body">{daily ? `Shapes won ${roundsWon}–${roundsLost}` : `${plural(you, 'cut', 'cuts')} vs ${plural(them, 'cut', 'cuts')}`}</p>
    </div>
  );
}

function Countdown({ onDone }: { onDone: () => void }) {
  const [ms, setMs] = useState(() => msUntilNextDay());
  useEffect(() => {
    const started = Date.now();
    const initial = msUntilNextDay();
    const id = window.setInterval(() => {
      // Compare against elapsed time so a midnight rollover is caught even if the tab slept.
      if (Date.now() - started >= initial) {
        window.clearInterval(id);
        onDone();
        return;
      }
      setMs(msUntilNextDay());
    }, 1000);
    return () => window.clearInterval(id);
  }, [onDone]);
  return (
    <p className="countdown">
      New shapes in <time className="countdown-time">{formatCountdown(ms)}</time>
    </p>
  );
}
