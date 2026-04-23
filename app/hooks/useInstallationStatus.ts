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

  const run = useCallback(
    async (fetcher: (id: number) => Promise<T>, setInFlight: (value: boolean) => void) => {
      try {
        setInFlight(true);
        setError(null);
        const data = await fetcher(targetSourceId);
        setStatus(data);
        if (isCompleteRef.current?.(data)) onCompleteRef.current?.(data);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setInFlight(false);
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
