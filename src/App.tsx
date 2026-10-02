import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { PlayScreen, type FinishAction } from './components/PlayScreen';
import { ResultScreen } from './components/ResultScreen';
import { StatsSheet } from './components/StatsSheet';
import { Toast } from './components/Toast';
import { quantiseLine } from './game/geometry';
import { compare, runScore, scoreRounds, ShapeSequence, type Round } from './game/run';
import { initAnalytics, setReferrer, track } from './lib/analytics';
import { dayNumber } from './lib/daily';
import { dailyStats, type SaveData } from './lib/storage';
import { sound } from './lib/sound';
import { dailyScreen, navigate, PATHS, readRoute, screenForRoute, survivalScreen, type Screen } from './state/routes';
import { useSave } from './state/useSave';

export function App() {
  const [today, setToday] = useState(() => dayNumber());
  const initialRoute = useMemo(() => readRoute(), []);
  const screenRef = useRef<Screen | null>(null);
  const cutsThisRun = useRef(0);

  // Another tab finished or advanced today's puzzle: follow it instead of overwriting it.
  const onExternalChange = useCallback(
    (fresh: SaveData) => {
      const current = screenRef.current;
      if (current?.kind !== 'play' || current.spec.mode !== 'daily' || current.spec.seed !== today) return;
      const theirCuts = fresh.dailyProgress?.day === today ? fresh.dailyProgress.cuts.length : 0;
      if (fresh.daily[today] || theirCuts > cutsThisRun.current) {
        setScreen(dailyScreen(fresh, today, current.opponent));
      }
    },
    [today],
  );

  const { save, saveRef, update, persistent } = useSave(today, onExternalChange);
  const [screen, setScreen] = useState<Screen>(() => screenForRoute(initialRoute, saveRef.current, today));
  screenRef.current = screen;
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    cutsThisRun.current = screen.kind === 'play' ? screen.resume.length : 0;
  }, [screen]);

  useEffect(() => {
    sound.muted = save.muted;
  }, [save.muted]);

  useEffect(() => {
    const s = saveRef.current;
    initAnalytics({ pid: s.playerId, age: today - s.firstSeenDay, day: today, ref: null });
    track('game_loaded', { returning: s.hasCut, route: initialRoute.kind });
    if (initialRoute.kind === 'challenge') {
      setReferrer(initialRoute.opponent.sharerId);
      track('challenge_opened', { mode: initialRoute.spec.mode, from: initialRoute.opponent.sharerId });
    } else if (initialRoute.kind === 'invalid-challenge') {
      track('challenge_invalid');
      setToast('That challenge link is broken. Here’s today’s puzzle.');
      navigate(PATHS.daily, true);
    }
    // Boot-time only.
  }, []);

  useEffect(() => {
    if (!persistent) setToast('This browser won’t let Halfsies save. Your scores won’t be kept.');
  }, [persistent]);

  // Back/forward buttons.
  useEffect(() => {
    const onPop = () => {
      setStatsOpen(false);
      setScreen(screenForRoute(readRoute(), saveRef.current, dayNumber()));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [saveRef]);

  const notify = useCallback((message: string) => setToast(message), []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeStats = useCallback(() => setStatsOpen(false), []);

  const handleProgress = useCallback(
    (rounds: Round[]) => {
      if (screen.kind !== 'play') return;
      const { spec } = screen;
      cutsThisRun.current = rounds.length;
      update((s) => ({
        ...s,
        hasCut: true,
        dailyProgress:
          spec.mode === 'daily' && spec.seed === today ? { day: today, cuts: rounds.map((r) => quantiseLine(r.line)) } : s.dailyProgress,
      }));
    },
    [screen, today, update],
  );

  const handleFinish = useCallback(
    (rounds: Round[], action: FinishAction) => {
      if (screen.kind !== 'play') return;
      const { spec, opponent } = screen;
      const score = runScore(spec.mode, rounds);
      const perfects = rounds.filter((r) => r.score.grade === 'perfect').length;
      const before = saveRef.current;
      let isNewBest = false;

      if (spec.mode === 'daily') {
        const previousBest = Math.max(0, ...Object.values(before.daily).map((r) => r.total));
        isNewBest = Object.keys(before.daily).length > 0 && score > previousBest;
        update((s) => ({
          ...s,
          perfects: s.perfects + perfects,
          dailyProgress: spec.seed === today ? null : s.dailyProgress,
          daily: {
            ...s.daily,
            [spec.seed]: {
              cuts: rounds.map((r) => quantiseLine(r.line)),
              points: rounds.map((r) => r.score.points),
              total: score,
              late: spec.seed < today,
            },
          },
        }));
      } else {
        isNewBest = score > before.survivalBest;
        update((s) => ({
          ...s,
          perfects: s.perfects + perfects,
          survivalRuns: s.survivalRuns + 1,
          survivalBest: Math.max(s.survivalBest, score),
        }));
      }

      track('game_completed', { mode: spec.mode, score, rounds: rounds.length, challenge: opponent !== null });
      if (isNewBest) track('new_high_score', { mode: spec.mode, score });
      if (opponent) {
        const theirs = scoreRounds(new ShapeSequence(spec), opponent.cuts);
        track('challenge_completed', { mode: spec.mode, outcome: compare(spec.mode, rounds, theirs).outcome, from: opponent.sharerId });
      }

      if (action === 'retry') {
        track('game_retried', { mode: spec.mode, from: 'play' });
        navigate(PATHS.survival, true);
        setScreen(survivalScreen());
        return;
      }
      setScreen({ kind: 'result', spec, rounds, opponent, isNewBest });
    },
    [screen, today, update, saveRef],
  );

  const playSurvival = useCallback(() => {
    if (screen.kind === 'result' && screen.spec.mode === 'survival') track('game_retried', { mode: 'survival', from: 'result' });
    navigate(PATHS.survival, screen.spec.mode === 'survival');
    setScreen(survivalScreen());
  }, [screen]);

  const playToday = useCallback(() => {
    navigate(PATHS.daily);
    setScreen(dailyScreen(saveRef.current, today, null));
  }, [today, saveRef]);

  const goHome = useCallback(() => {
    const onToday = screen.spec.mode === 'daily' && screen.spec.seed === today && !screen.opponent;
    if (!onToday) playToday();
  }, [screen, today, playToday]);

  const handleNewDay = useCallback(() => {
    const next = dayNumber();
    setToday(next);
    if (screenRef.current?.kind === 'result') {
      navigate(PATHS.daily, true);
      setScreen(dailyScreen(saveRef.current, next, null));
    }
  }, [saveRef]);

  // Coming back to a tab the next morning should show the new puzzle, not yesterday's result.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && dayNumber() !== today) handleNewDay();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [today, handleNewDay]);

  const toggleSound = useCallback(() => {
    sound.unlock();
    update((s) => ({ ...s, muted: !s.muted }));
  }, [update]);

  const setName = useCallback((name: string) => update((s) => ({ ...s, name: name.slice(0, 16) })), [update]);

  return (
    <div className="app">
      <Header muted={save.muted} onToggleSound={toggleSound} onOpenStats={() => setStatsOpen(true)} onHome={goHome} />
      <ErrorBoundary>
        {screen.kind === 'play' ? (
          <PlayScreen
            key={screen.runId}
            spec={screen.spec}
            opponent={screen.opponent}
            resume={screen.resume}
            firstTime={!save.hasCut}
            survivalBest={save.survivalBest}
            onProgress={handleProgress}
            onFinish={handleFinish}
          />
        ) : (
          <ResultScreen
            spec={screen.spec}
            rounds={screen.rounds}
            opponent={screen.opponent}
            today={today}
            name={save.name}
            playerId={save.playerId}
            stats={dailyStats(save, today)}
            survivalBest={save.survivalBest}
            isNewBest={screen.isNewBest}
            todayPlayed={save.daily[today] !== undefined}
            onNameChange={setName}
            onPlaySurvival={playSurvival}
            onPlayToday={playToday}
            onNewDay={handleNewDay}
            notify={notify}
          />
        )}
      </ErrorBoundary>
      {statsOpen && (
        <StatsSheet stats={dailyStats(save, today)} perfects={save.perfects} survivalBest={save.survivalBest} onClose={closeStats} />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
