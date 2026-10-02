import { useEffect } from 'react';

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(id);
  }, [message, onDone]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast" key={message}>
          {message}
        </div>
      )}
    </div>
  );
}
