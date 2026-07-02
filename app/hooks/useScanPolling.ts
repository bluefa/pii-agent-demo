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
  const prevScanStatusRef = useRef<ScanJob['scan_status'] | null>(null);
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
    if (prevScanStatusRef.current === 'SCANNING' && job?.scan_status !== 'SCANNING') {
      onScanCompleteRef.current?.();
    }
    prevScanStatusRef.current = job?.scan_status ?? null;
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

  return {
    latestJob,
    uiState,
    isPolling,
    loading,
    error,
    refresh,
    startPolling: start,
    stopPolling: stop,
  };
};

export default useScanPolling;
