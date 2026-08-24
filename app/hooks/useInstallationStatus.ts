'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_MESSAGES } from '@/lib/constants/messages';

interface UseInstallationStatusOptions<T> {
  targetSourceId: number;
  getFn: (id: number) => Promise<T>;
  checkFn?: (id: number) => Promise<T>;
  onComplete?: (status: T) => void;
  isComplete?: (status: T) => boolean;
  /**
   * Re-GET this often (ms) while the install has not settled. Requires
   * `isComplete` — without a predicate there is no way to stop, so the poll
   * stays off rather than running forever.
   *
   * Omit it and the hook keeps its original behaviour: one fetch on mount.
   */
  pollIntervalMs?: number;
}

/**
 * Step 4 poll cadence. Installs move in minutes, not seconds — Step 5's
 * connection test polls at 4s because a run finishes inside a coffee sip, and
 * that cadence here would be ~900 requests per hour of watching.
 */
export const INSTALL_POLL_INTERVAL_MS = 30_000;

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
  pollIntervalMs,
}: UseInstallationStatusOptions<T>): UseInstallationStatusResult<T> {
  const [status, setStatus] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether the last answer said "done". Kept as state, not derived in render:
  // the poll effect keys off it, and re-deriving it per render from `isComplete`
  // (an inline arrow at every call site) would restart the interval on every
  // render — a timer that is reset before it can ever fire.
  const [settled, setSettled] = useState(false);

  // Reset during render on id change, not in the effect: the effect's reset
  // lands after paint, so the first render for the new target still carries the
  // PREVIOUS target's status/error with loading stale-false — i.e. "settled,
  // and here is someone else's failure". The install cards are not remounted by
  // key. Same idiom as ConfirmedIntegrationDataProvider.
  const [activeId, setActiveId] = useState(targetSourceId);
  if (targetSourceId !== activeId) {
    setActiveId(targetSourceId);
    setStatus(null);
    setError(null);
    setLoading(true);
    setSettled(false);
  }

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
        if (isCompleteRef.current?.(data)) {
          setSettled(true);
          onCompleteRef.current?.(data);
        }
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

  // A predicate is what makes the poll stoppable — see `pollIntervalMs`.
  // Read as a boolean, not the function: call sites pass inline arrows, so the
  // function's identity changes every render and would restart the interval.
  const canSettle = isComplete !== undefined;

  // Background poll. Deliberately NOT `run`: a poll must not narrate itself.
  // `run` clears `error` on entry and sets it on failure, so one dropped packet
  // would swap a good snapshot for the full-card error view — the screen would
  // erase what it knows because it failed to confirm it. A failed tick keeps
  // the last answer and waits for the next one; the user-facing consequence is
  // only that the header's "마지막 확인" keeps counting up, which is the truth.
  useEffect(() => {
    if (!pollIntervalMs || !canSettle || settled) return;

    let cancelled = false;
    const id = setInterval(() => {
      // The run that is current as this tick starts. If a real run (mount fetch
      // or refresh) begins while the tick is in flight, that one wins and this
      // answer is dropped. The tick never bumps the counter itself: doing so
      // would orphan an in-flight run's `finally` and strand `loading` at true.
      const startedAt = runIdRef.current;
      getFn(targetSourceId)
        .then((data) => {
          if (cancelled || runIdRef.current !== startedAt) return;
          setStatus(data);
          if (isCompleteRef.current?.(data)) {
            setSettled(true);
            onCompleteRef.current?.(data);
          }
        })
        .catch(() => {
          // Keep the last good snapshot. Next tick may well succeed.
        });
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollIntervalMs, canSettle, settled, getFn, targetSourceId]);

  return { status, loading, refreshing, error, fetchStatus, refresh };
}
