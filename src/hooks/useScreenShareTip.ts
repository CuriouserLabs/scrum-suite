import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drives the one-time "Sharing your screen?" coach tip that points hosts and
 * co-hosts at the new "hide my own items" toggle.
 *
 * The tip latches the first time `trigger` flips true (session created, or the
 * viewer was just promoted to co-host) and stays up until dismissed. Dismissal
 * is persisted in `localStorage` keyed by the session, so the tip never
 * reappears for that session — but a brand-new room/retro gets a fresh key and
 * therefore a fresh tip, matching the requirement to coach every new session.
 *
 * @param storageKey  Stable per-session key (e.g. `sst:poker:<roomId>:<userId>`),
 *                    or `null` while the session id is not yet known.
 * @param trigger     Becomes true once the viewer should be coached.
 */
export function useScreenShareTip(storageKey: string | null, trigger: boolean) {
  const [show, setShow] = useState(false);
  const latchedRef = useRef(false);

  useEffect(() => {
    if (!storageKey || !trigger || latchedRef.current) return;
    latchedRef.current = true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey) === '1';
    } catch {
      // localStorage unavailable (private mode / blocked) — show anyway.
    }
    if (!dismissed) setShow(true);
  }, [storageKey, trigger]);

  const dismiss = useCallback(() => {
    setShow(false);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Best effort — if we can't persist, the tip simply won't be remembered.
    }
  }, [storageKey]);

  return { show, dismiss };
}
