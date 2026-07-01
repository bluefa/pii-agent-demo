import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePollingBaseOptions<T> {
  interval: number;
  fetchOnce: () => Promise<T>;
  shouldStop: (value: T) => boolean;
  onUpdate?: (value: T) => void;
  onComplete?: (value: T) => void;
  enabled?: boolean;
}

export interface UsePollingBaseResult<T> {
  data: T | null;
  error: Error | null;
  isPolling: boolean;
  refresh: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

/**
 * A hard-failing endpoint must not be polled forever: after this many
 * consecutive fetch errors the session finishes (isPolling → false, last
 * error kept). Success resets the counter, so transient blips survive.
 */
const MAX_CONSECUTIVE_ERRORS = 3;

export const usePollingBase = <T,>(
  options: UsePollingBaseOptions<T>,
): UsePollingBaseResult<T> => {
  const {
    interval,
    fetchOnce,
    shouldStop,
    onUpdate,
    onComplete,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState(enabled ? 1 : 0);
  const [finishedSession, setFinishedSession] = useState(0);

  const isPolling = session !== 0 && finishedSession !== session;

  const fetchRef = useRef(fetchOnce);
  const stopFnRef = useRef(shouldStop);
  const updateRef = useRef(onUpdate);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    fetchRef.current = fetchOnce;
    stopFnRef.current = shouldStop;
    updateRef.current = onUpdate;
    completeRef.current = onComplete;
  });

  // The polling effect has a per-session `cancelled` flag, but `refresh` is a
  // standalone async callback — it needs its own unmount guard so a slow
  // response cannot fire setState/onUpdate after the component is gone.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const value = await fetchRef.current();
      if (!mountedRef.current) return;
      setData(value);
      setError(null);
      updateRef.current?.(value);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err as Error);
    }
  }, []);

  const start = useCallback(() => setSession((s) => s + 1), []);
  const stop = useCallback(() => setSession(0), []);

  useEffect(() => {
    if (session === 0) return;

    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;
    let stopped = false;
    let consecutiveErrors = 0;

    const tick = async () => {
      try {
        const value = await fetchRef.current();
        if (cancelled) return;
        consecutiveErrors = 0;
        setData(value);
        setError(null);
        updateRef.current?.(value);
        if (stopFnRef.current(value)) {
          stopped = true;
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          setFinishedSession(session);
          completeRef.current?.(value);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err as Error);
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          stopped = true;
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          setFinishedSession(session);
        }
      }
    };

    void tick().then(() => {
      if (cancelled || stopped) return;
      timer = setInterval(tick, interval);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [session, interval]);

  return { data, error, isPolling, refresh, start, stop };
};
