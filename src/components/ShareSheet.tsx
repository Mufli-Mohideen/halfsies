import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';
import { canShareNatively, copyText, fullText, shareNatively, shareTargets, type ShareMessage, type ShareOutcome } from '../lib/share';
import { Sheet } from './Sheet';

interface ShareSheetProps {
  message: ShareMessage;
  name: string;
  mode: string;
  onNameChange: (name: string) => void;
  onSaveImage: () => Promise<ShareOutcome>;
  onClose: () => void;
  notify: (message: string) => void;
}

const COPIED_HOLD_MS = 900;

const NOTICES: Partial<Record<ShareOutcome, string>> = {
  downloaded: 'Image saved. Post it to your story.',
  failed: 'Couldn’t share from this browser. Try Copy link.',
};

export function ShareSheet({ message, name, mode, onNameChange, onSaveImage, onClose, notify }: ShareSheetProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);

  // Confirm in place, then get out of the way.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setDone(true), COPIED_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [copied]);
  const targets = shareTargets(message);
  const native = canShareNatively();

  const record = (channel: string, outcome: ShareOutcome | 'opened') => {
    track('share_completed', { channel, outcome, mode });
    if (outcome !== 'cancelled' && outcome !== 'failed') track('challenge_created', { channel, mode });
  };

  const run = async (channel: string, action: () => Promise<ShareOutcome>) => {
    if (busy || copied) return;
    setBusy(channel);
    const outcome = await action().catch((): ShareOutcome => 'failed');
    setBusy(null);
    record(channel, outcome);
    if (outcome === 'copied') {
      setCopied(true); // the button says so; no toast needed
      return;
    }
    const notice = NOTICES[outcome];
    if (notice) notify(notice);
    if (outcome === 'shared') setDone(true);
  };

  const copyLink = () => run('copy', async () => ((await copyText(fullText(message))) ? 'copied' : 'failed'));
  const copyLabel = copied ? 'Copied ✓' : 'Copy link';

  return (
    <Sheet title="Challenge a friend" onClose={onClose} closing={done}>
      <label className="field">
        <span className="field-label">Your name, as your friend will see it</span>
        <input
          value={name}
          maxLength={16}
          placeholder="Optional"
          autoComplete="nickname"
          enterKeyHint="done"
          onChange={(e) => onNameChange(e.target.value)}
        />
      </label>

      <figure className="share-preview" aria-label="Message preview">
        <p>{message.text}</p>
        <figcaption>{message.url.replace(/^https?:\/\//, '')}</figcaption>
      </figure>

      <div className="share-actions">
        {native ? (
          <button className="btn btn-primary btn-wide" disabled={busy !== null} onClick={() => run('native', () => shareNatively(message))}>
            Send challenge
          </button>
        ) : (
          <button className={`btn btn-primary btn-wide ${copied ? 'is-confirmed' : ''}`} disabled={busy !== null} onClick={copyLink} aria-live="polite">
            {copyLabel}
          </button>
        )}
        <div className="share-grid">
          <a className="btn btn-secondary" href={targets.whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => record('whatsapp', 'opened')}>
            WhatsApp
          </a>
          <a className="btn btn-secondary" href={targets.x} target="_blank" rel="noopener noreferrer" onClick={() => record('x', 'opened')}>
            X
          </a>
          <a className="btn btn-secondary" href={targets.facebook} target="_blank" rel="noopener noreferrer" onClick={() => record('facebook', 'opened')}>
            Facebook
          </a>
          {native && (
            <button className={`btn btn-secondary ${copied ? 'is-confirmed' : ''}`} disabled={busy !== null} onClick={copyLink} aria-live="polite">
              {copyLabel}
            </button>
          )}
        </div>
        <button className="btn btn-ghost btn-wide" disabled={busy !== null} onClick={() => run('image', onSaveImage)}>
          {busy === 'image' ? 'Preparing…' : 'Save image for Stories'}
        </button>
      </div>
    </Sheet>
  );
}
