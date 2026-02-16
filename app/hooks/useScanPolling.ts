import { useState, useEffect, useCallback, useRef } from 'react';
import { getLatestScanJob } from '@/app/lib/api/scan';
import type { AppError } from '@/lib/errors';
import type { V1ScanJob } from '@/lib/types';

// ===== Types =====

export type ScanUIState = 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface UseScanPollingOptions {
  /** 폴링 간격 (ms). 기본값 2000 */
  interval?: number;
  /** 스캔 완료 시 콜백 */
  onScanComplete?: () => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: AppError) => void;
  /** 마운트 시 자동 시작. 기본값 true */
  autoStart?: boolean;
}

export interface UseScanPollingReturn {
  latestJob: V1ScanJob | null;
  uiState: ScanUIState;
  isPolling: boolean;
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

// ===== Helper Functions =====

const computeUIState = (job: V1ScanJob | null): ScanUIState => {
  if (!job) return 'IDLE';
  switch (job.scanStatus) {
    case 'SCANNING': return 'IN_PROGRESS';
    case 'SUCCESS': return 'COMPLETED';
    case 'FAIL':
    case 'TIMEOUT': return 'FAILED';
    case 'CANCELED': return 'IDLE';
    default: return 'IDLE';
  }
};

// ===== Hook =====

/**
 * v1 스캔 상태 폴링 훅
 *
 * @example
 * const { latestJob, uiState, refresh } = useScanPolling(targetSourceId, {
 *   onScanComplete: () => {
 *     toast.success('스캔이 완료되었습니다.');
 *     refetchResources();
 *   },
 * });
 */
export const useScanPolling = (
  targetSourceId: number,
  options: UseScanPollingOptions = {}
): UseScanPollingReturn => {
  const { interval = 2000, onScanComplete, onError, autoStart = true } = options;

  const [latestJob, setLatestJob] = useState<V1ScanJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Refs for cleanup and state tracking
  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevScanStatusRef = useRef<V1ScanJob['scanStatus'] | null>(null);

  // 콜백을 ref로 관리하여 의존성 배열 문제 해결
  const onScanCompleteRef = useRef(onScanComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onScanCompleteRef.current = onScanComplete;
    onErrorRef.current = onError;
  }, [onScanComplete, onError]);

  // 스캔 상태 조회
  const fetchStatus = useCallback(async (): Promise<V1ScanJob | null> => {
    try {
      const job = await getLatestScanJob(targetSourceId);

      if (!mountedRef.current) return null;

      setLatestJob(job);
      setError(null);

      // 완료 감지: 이전에 SCANNING이었는데 현재는 아닌 경우
      if (prevScanStatusRef.current === 'SCANNING' && job?.scanStatus !== 'SCANNING') {
        onScanCompleteRef.current?.();
      }
      prevScanStatusRef.current = job?.scanStatus ?? null;

      return job;
    } catch (err) {
      if (!mountedRef.current) return null;

      const appErr = err as AppError;
      if (appErr.code === 'NOT_FOUND') {
        setLatestJob(null);
        setError(null);
        return null;
      }
      setError(appErr);
      onErrorRef.current?.(appErr);
      return null;
    }
  }, [targetSourceId]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

    setIsPolling(true);
    pollingRef.current = setInterval(async () => {
      const job = await fetchStatus();

      // 스캔이 완료되면 폴링 중지
      if (job && job.scanStatus !== 'SCANNING') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsPolling(false);
      }
    }, interval);
  }, [fetchStatus, interval]);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 수동 새로고침
  const refresh = useCallback(async () => {
    setLoading(true);
    const job = await fetchStatus();
    setLoading(false);

    // 스캔 진행 중이면 폴링 시작
    if (job?.scanStatus === 'SCANNING' && !pollingRef.current) {
      startPolling();
    }
  }, [fetchStatus, startPolling]);

  // 초기 로드
  useEffect(() => {
    mountedRef.current = true;
    let isCancelled = false;

    const init = async () => {
      if (!autoStart) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const job = await getLatestScanJob(targetSourceId);

        if (isCancelled || !mountedRef.current) return;

        setLatestJob(job);
        prevScanStatusRef.current = job?.scanStatus ?? null;

        // 스캔 진행 중이면 자동으로 폴링 시작
        if (job?.scanStatus === 'SCANNING' && !pollingRef.current) {
          setIsPolling(true);
          pollingRef.current = setInterval(async () => {
            const newJob = await getLatestScanJob(targetSourceId);
            if (!mountedRef.current) return;

            setLatestJob(newJob);

            // 완료 감지
            if (prevScanStatusRef.current === 'SCANNING' && newJob?.scanStatus !== 'SCANNING') {
              onScanCompleteRef.current?.();
            }
            prevScanStatusRef.current = newJob?.scanStatus ?? null;

            // 스캔 완료 시 폴링 중지
            if (newJob?.scanStatus !== 'SCANNING') {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              setIsPolling(false);
            }
          }, interval);
        }
      } catch (err) {
        if (!isCancelled && mountedRef.current) {
          const appErr = err as AppError;
          if (appErr.code === 'NOT_FOUND') {
            setLatestJob(null);
            setError(null);
          } else {
            setError(appErr);
            onErrorRef.current?.(appErr);
          }
        }
      } finally {
        if (!isCancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isCancelled = true;
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [targetSourceId, autoStart, interval]);

  const uiState = computeUIState(latestJob);

  return {
    latestJob,
    uiState,
    isPolling,
    loading,
    error,
    refresh,
    startPolling,
    stopPolling,
  };
};

export default useScanPolling;
