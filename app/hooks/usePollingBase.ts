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

  const refresh = useCallback(async () => {
    try {
      const value = await fetchRef.current();
      setData(value);
      setError(null);
      updateRef.current?.(value);
    } catch (err) {
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

    const tick = async () => {
      try {
        const value = await fetchRef.current();
        if (cancelled) return;
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
