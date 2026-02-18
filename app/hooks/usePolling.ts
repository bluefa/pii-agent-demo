import { useRef, useEffect, useCallback } from 'react';

interface UsePollingOptions<T> {
  fn: () => Promise<T>;
  interval: number;
  shouldStop?: (result: T) => boolean;
  onStop?: (result: T) => void;
}

export function usePolling<T>({ fn, interval, shouldStop, onStop }: UsePollingOptions<T>) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  const shouldStopRef = useRef(shouldStop);
  const onStopRef = useRef(onStop);

  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => { shouldStopRef.current = shouldStop; }, [shouldStop]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const result = await fnRef.current();
        if (!mountedRef.current) return;
        if (shouldStopRef.current?.(result)) {
          stop();
          if (mountedRef.current) {
            onStopRef.current?.(result);
          }
        }
      } catch {
        // polling errors are silently ignored (caller handles via shouldStop)
      }
    }, interval);
  }, [interval, stop]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return { start, stop };
}
