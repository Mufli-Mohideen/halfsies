import type { DailyStats } from '../lib/storage';
import { Sheet } from './Sheet';
import { StudioCredit } from './StudioCredit';

interface StatsSheetProps {
  stats: DailyStats;
  perfects: number;
  survivalBest: number;
  onClose: () => void;
}

const BAND_LABELS = ['0–99', '100–199', '200–299', '300–399', '400–500'];

export function StatsSheet({ stats, perfects, survivalBest, onClose }: StatsSheetProps) {
  const peak = Math.max(1, ...stats.bands);
  const cells: [string, number | string][] = [
    ['Played', stats.played],
    ['Streak', stats.streak],
    ['Longest streak', stats.maxStreak],
    ['Average', stats.average || '–'],
    ['Best day', stats.best || '–'],
    ['Perfect cuts', perfects],
    ['Sudden death best', survivalBest || '–'],
  ];

  return (
    <Sheet title="How to play" onClose={onClose}>
      <ol className="rules">
        <li>Swipe once across the shape. The cut is a straight line, edge to edge.</li>
        <li>The closer to 50.0 / 50.0, the more points. Each shape is worth up to 100.</li>
        <li>Everyone gets the same five shapes each day. Send your link and a friend cuts them too, with your cuts shown next to theirs.</li>
      </ol>

      <h2 className="t-heading">Your stats</h2>
      {stats.played === 0 && survivalBest === 0 ? (
        <p className="t-body sheet-empty">Finish today’s five shapes and your stats start here.</p>
      ) : (
        <>
          <dl className="stat-grid">
            {cells.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {stats.played > 0 && (
            <div className="bands" role="img" aria-label={`Daily scores: ${stats.bands.map((c, i) => `${c} in ${BAND_LABELS[i]}`).join(', ')}`}>
              {stats.bands.map((count, i) => (
                <div className="band" key={i}>
                  <span className="band-label">{BAND_LABELS[i]}</span>
                  <span className="band-track">
                    <span className="band-bar" style={{ width: `${(count / peak) * 100}%` }} />
                  </span>
                  <span className="band-count">{count}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="fineprint">No account. Your scores stay on this device.</p>
      <StudioCredit />
    </Sheet>
  );
}
