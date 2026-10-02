import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface SheetProps {
  title: string;
  onClose: () => void;
  /** Set by the owner to close with the exit animation (e.g. after a successful share). */
  closing?: boolean;
  children: ReactNode;
}

const EXIT_MS = 200;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom sheet on phones, centred panel on larger screens. Traps focus and returns it on close. */
export function Sheet({ title, onClose, closing = false, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [leaving, setLeaving] = useState(false);

  // Every way out (×, backdrop, Escape, owner) plays the same short exit, then unmounts.
  const requestClose = useCallback(() => setLeaving(true), []);
  useEffect(() => {
    if (closing) setLeaving(true);
  }, [closing]);
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => closeRef.current(), prefersReducedMotion() ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [requestClose]);

  return (
    <div className={`sheet-backdrop ${leaving ? 'is-leaving' : ''}`} onClick={requestClose}>
      <section
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id={titleId} className="t-heading">
            {title}
          </h2>
          <button className="icon-btn" onClick={requestClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
