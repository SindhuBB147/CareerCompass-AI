'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUserAuth } from '../contexts/UserAuthContext';
import { sessionStateApi, SessionState } from '../lib/session-state-api';

const DEBOUNCE_MS = 800;

/**
 * "Continue where you left off" — hydrates once from GET /session-state on
 * mount, then batches subsequent patch() calls into a single debounced
 * PATCH so rapid filter/sort changes don't fire a request per keystroke.
 * Local `state` updates immediately (optimistic); the network write trails
 * behind it. No-ops entirely for signed-out visitors.
 */
export function useSessionState() {
  const { accessToken, isAuthenticated } = useUserAuth();
  const [state, setState] = useState<SessionState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pendingRef = useRef<Partial<SessionState>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setState(null); setHydrated(true); return; }
    setHydrated(false);
    sessionStateApi.get(accessToken)
      .then(s => setState(s))
      .catch(() => setState(null))
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const patch = useCallback((partial: Partial<SessionState>) => {
    if (!isAuthenticated) return;
    setState(prev => ({ ...(prev ?? {}), ...partial }) as SessionState);
    pendingRef.current = { ...pendingRef.current, ...partial };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const toSend = pendingRef.current;
      pendingRef.current = {};
      sessionStateApi.patch(toSend, accessToken).catch(() => {
        // Best-effort — session restore is a convenience, not a source of truth.
      });
    }, DEBOUNCE_MS);
  }, [isAuthenticated, accessToken]);

  return { state, hydrated, patch };
}
