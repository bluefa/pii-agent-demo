'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_MESSAGES } from '@/lib/constants/messages';

interface UseInstallationStatusOptions<T> {
  targetSourceId: number;
  getFn: (id: number) => Promise<T>;
  checkFn?: (id: number) => Promise<T>;
  onComplete?: (status: T) => void;
  isComplete?: (status: T) => boolean;
}

export interface UseInstallationStatusResult<T> {
  status: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  refresh: () => Promise<void>;
}

const toErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : ERROR_MESSAGES.STATUS_FETCH_FAILED;

export function useInstallationStatus<T>({
  targetSourceId,
  getFn,
  checkFn,
  onComplete,
  isComplete,
}: UseInstallationStatusOptions<T>): UseInstallationStatusResult<T> {
  const [status, setStatus] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCompleteRef = useRef(onComplete);
  const isCompleteRef = useRef(isComplete);
  onCompleteRef.current = onComplete;
  isCompleteRef.current = isComplete;

  // Stale-response guard: the fetch effect refires on targetSourceId change
  // without cancelling the in-flight request, so a slow response for the
  // previous id must not overwrite the current one. Last started run wins.
  const runIdRef = useRef(0);

  const run = useCallback(
    async (fetcher: (id: number) => Promise<T>, setInFlight: (value: boolean) => void) => {
      const runId = ++runIdRef.current;
      // A new run supersedes any in-flight one, whose guarded finally will not
      // execute — clear both flags up front so it cannot leave a stuck spinner.
      setLoading(false);
      setRefreshing(false);
      try {
        setInFlight(true);
        setError(null);
        const data = await fetcher(targetSourceId);
        if (runIdRef.current !== runId) return;
        setStatus(data);
        if (isCompleteRef.current?.(data)) onCompleteRef.current?.(data);
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setError(toErrorMessage(err));
      } finally {
        if (runIdRef.current === runId) setInFlight(false);
      }
    },
    [targetSourceId],
  );

  const fetchStatus = useCallback(() => run(getFn, setLoading), [run, getFn]);
  const refresh = useCallback(async () => {
    if (!checkFn) return;
    await run(checkFn, setRefreshing);
  }, [run, checkFn]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refreshing, error, fetchStatus, refresh };
}
