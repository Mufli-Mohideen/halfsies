import { Wordmark } from './Wordmark';

interface HeaderProps {
  muted: boolean;
  onToggleSound: () => void;
  onOpenStats: () => void;
  onHome: () => void;
}

export function Header({ muted, onToggleSound, onOpenStats, onHome }: HeaderProps) {
  return (
    <header className="topbar">
      <button className="topbar-home" onClick={onHome} aria-label="Halfsies, today’s puzzle">
        <Wordmark />
      </button>
      <div className="topbar-actions">
        <button className="icon-btn" onClick={onToggleSound} aria-label={muted ? 'Turn sound and vibration on' : 'Turn sound and vibration off'}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            {muted ? (
              <path d="M15.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <button className="icon-btn" onClick={onOpenStats} aria-label="How to play and stats">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path d="M6 19v-6M12 19V5M18 19v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}
