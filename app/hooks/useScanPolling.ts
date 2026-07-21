import { useCallback, useEffect, useRef, useState } from 'react';
import { getLatestScanJob } from '@/app/lib/api/scan';
import type { AppError } from '@/lib/errors';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { usePollingBase } from '@/app/hooks/usePollingBase';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

export type ScanUIState = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface UseScanPollingOptions {
  interval?: number;
  onScanComplete?: () => void;
  onError?: (error: AppError) => void;
  autoStart?: boolean;
}

export interface UseScanPollingReturn {
  latestJob: ScanJob | null;
  uiState: ScanUIState;
  isPolling: boolean;
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  /**
   * Mark that a scan was just started by this client, so the NEXT terminal job
   * observation fires onScanComplete even when the job carries no `id` and the
   * SCANNING state was never witnessed (a fast scan finishing before the first
   * poll). Identity/edge detection alone cannot see that case. Pass the started
   * job's id (from the startScan response) when available — it pins the arm to
   * that job so a stale in-flight response for an OLDER job can neither fire nor
   * consume the arm.
   */
  expectCompletion: (expectedJobId?: number) => void;
}

const computeUIState = (job: ScanJob | null): ScanUIState => {
  if (!job) return 'IDLE';
  switch (job.scan_status) {
    case 'SCANNING': return 'IN_PROGRESS';
    case 'SUCCESS': return 'COMPLETED';
    case 'FAIL':
    case 'TIMEOUT': return 'FAILED';
    case 'CANCELED':
    default: return 'IDLE';
  }
};

const fetchLatestScan = async (targetSourceId: number): Promise<ScanJob | null> => {
  try {
    return await getLatestScanJob(targetSourceId);
  } catch (err) {
    const appErr = err as AppError;
    if (appErr.code === 'NOT_FOUND') return null;
    throw appErr;
  }
};

export const useScanPolling = (
  targetSourceId: number,
  options: UseScanPollingOptions = {},
): UseScanPollingReturn => {
  const { interval = 2000, onScanComplete, onError, autoStart = true } = options;

  const [loading, setLoading] = useState(autoStart);
  const [error, setError] = useState<AppError | null>(null);
  // Completion is detected primarily by job identity, not by observing a
  // SCANNING→terminal edge: a fast scan can land wholly between two polls (or
  // complete before the first poll), so the edge is never witnessed and
  // onScanComplete would be missed. We fire when a NEW terminal job id appears.
  // On the first observation a pre-existing terminal job is adopted as "already
  // notified" so mounting on an old completed scan does not fire (which would
  // wipe Step-1 selection). `id` is optional on the contract (ScanJobResponse is
  // partial), so when it is absent we fall back to the SCANNING→terminal edge.
  const notifiedJobIdRef = useRef<number | null>(null);
  const prevScanStatusRef = useRef<ScanJob['scan_status'] | null>(null);
  // Armed by expectCompletion() when this client starts a scan — covers a fast
  // no-id scan that is already terminal on the very next observation. When the
  // started job's id is known it is pinned here so stale responses for older
  // jobs cannot satisfy the arm.
  const awaitingCompletionRef = useRef(false);
  const expectedJobIdRef = useRef<number | null>(null);
  const firstObservationRef = useRef(true);
  const firstFetchRef = useRef(true);

  const onScanCompleteRef = useRef(onScanComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onScanCompleteRef.current = onScanComplete;
    onErrorRef.current = onError;
  });

  const fetchOnce = useCallback(
    () => fetchLatestScan(targetSourceId),
    [targetSourceId],
  );

  const shouldStop = useCallback(
    (job: ScanJob | null) => !job || job.scan_status !== 'SCANNING',
    [],
  );

  const handleUpdate = useCallback((job: ScanJob | null) => {
    const id = job?.id ?? null;
    const isTerminal = !!job && job.scan_status !== 'SCANNING';
    const isSuccess = job?.scan_status === 'SUCCESS';
    const isFirst = firstObservationRef.current;
    const sawScanning = prevScanStatusRef.current === 'SCANNING';
    firstObservationRef.current = false;
    prevScanStatusRef.current = job?.scan_status ?? null;

    if (isTerminal) {
      const armed = awaitingCompletionRef.current;
      // While armed for a KNOWN job id, a response carrying a DIFFERENT id is a
      // stale read of an older job: it must neither fire nor consume the arm.
      // Responses without an id cannot be distinguished, so they pass through.
      const matchesExpected = id === null
        || expectedJobIdRef.current === null
        || id === expectedJobIdRef.current;
      // New completion: with a pinned expected id, only that exact job counts;
      // otherwise a job id we have not notified for (on the first observation a
      // pre-existing terminal job is adopted instead — no fire — unless this
      // client armed a scan while the first read was still failing). When the
      // contract omits `id`, fall back to the SCANNING→terminal edge or the
      // armed fast scan.
      const isNewCompletion = id !== null
        ? (armed && expectedJobIdRef.current !== null
            ? id === expectedJobIdRef.current
            : notifiedJobIdRef.current !== id && (!isFirst || armed))
        : sawScanning || armed;
      if (id !== null) notifiedJobIdRef.current = id;
      if (!armed || matchesExpected) {
        awaitingCompletionRef.current = false;
        expectedJobIdRef.current = null;
        // Only SUCCESS refreshes Step-1 — the callback resets selection and
        // refetches, so FAIL/TIMEOUT/CANCELED must not wipe the user's work.
        if (isNewCompletion && isSuccess) onScanCompleteRef.current?.();
      }
    }
    setError(null);
    if (firstFetchRef.current) {
      firstFetchRef.current = false;
      setLoading(false);
    }
  }, []);

  const {
    data: latestJob,
    error: baseError,
    isPolling,
    refresh: baseRefresh,
    start,
    stop,
  } = usePollingBase<ScanJob | null>({
    interval,
    fetchOnce,
    shouldStop,
    onUpdate: handleUpdate,
    enabled: autoStart,
  });

  useEffect(() => {
    if (!baseError) return;
    const appErr = baseError as AppError;
    setError(appErr);
    onErrorRef.current?.(appErr);
    // A first poll that settles as an error still ends the initial load — otherwise
    // `loading` stays true forever and any button gated on it (e.g. Run Infra Scan)
    // is frozen disabled. The error is surfaced via `error`; it must not block the UI.
    if (firstFetchRef.current) {
      firstFetchRef.current = false;
      setLoading(false);
    }
  }, [baseError]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await baseRefresh();
    } finally {
      setLoading(false);
    }
  }, [baseRefresh]);

  // Auto-restart only while healthy: after usePollingBase stops a session on
  // consecutive fetch errors, baseError is set and a stale SCANNING job must
  // not immediately start a new session (that would defeat the error stop).
  useEffect(() => {
    if (latestJob?.scan_status === 'SCANNING' && !isPolling && !baseError) {
      start();
    }
  }, [latestJob, isPolling, baseError, start]);

  const uiState = computeUIState(latestJob);

  const expectCompletion = useCallback((expectedJobId?: number) => {
    awaitingCompletionRef.current = true;
    expectedJobIdRef.current = expectedJobId ?? null;
  }, []);

  return {
    latestJob,
    uiState,
    isPolling,
    loading,
    error,
    refresh,
    startPolling: start,
    stopPolling: stop,
    expectCompletion,
  };
};

export default useScanPolling;
