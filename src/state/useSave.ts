import { useCallback, useEffect, useRef, useState } from 'react';
import { dayNumber } from '../lib/daily';
import { loadSave, SAVE_KEY, writeSave, type SaveData } from '../lib/storage';

interface UseSave {
  save: SaveData;
  /** Always the latest value, for event handlers that outlive a render. */
  saveRef: { readonly current: SaveData };
  update: (change: (s: SaveData) => SaveData) => void;
  /** False once a write fails (storage blocked or full): the game still runs, it just can't remember. */
  persistent: boolean;
}

/**
 * The save file, written through on every change and kept in sync across tabs.
 * Writes happen here (not in an effect) so a save that arrives from another tab
 * is never echoed back, which would ping-pong between tabs.
 */
export function useSave(today: number, onExternalChange: (fresh: SaveData) => void): UseSave {
  const ref = useRef<SaveData | null>(null);
  if (ref.current === null) ref.current = loadSave(today);
  const [save, setSave] = useState<SaveData>(ref.current);
  const [persistent, setPersistent] = useState(true);
  const externalRef = useRef(onExternalChange);
  externalRef.current = onExternalChange;

  const update = useCallback((change: (s: SaveData) => SaveData) => {
    const next = change(ref.current!);
    ref.current = next;
    if (!writeSave(next)) setPersistent(false);
    setSave(next);
  }, []);

  useEffect(() => {
    // Persist the anonymous id and first-seen day straight away.
    if (!writeSave(ref.current!)) setPersistent(false);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SAVE_KEY && e.key !== null) return;
      const fresh = loadSave(dayNumber());
      ref.current = fresh;
      setSave(fresh);
      externalRef.current(fresh);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { save, saveRef: ref as { readonly current: SaveData }, update, persistent };
}
