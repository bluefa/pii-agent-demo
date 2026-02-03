import { useState, useEffect, useCallback, useRef } from 'react';
import { getScanStatus, ScanStatusResponse } from '@/app/lib/api/scan';

// ===== Types =====

export type ScanUIState = 'IDLE' | 'COOLDOWN' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface UseScanPollingOptions {
  /** 폴링 간격 (ms). 기본값 2000 */
  interval?: number;
  /** 스캔 완료 시 콜백 */
  onScanComplete?: () => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
  /** 마운트 시 자동 시작. 기본값 true */
  autoStart?: boolean;
}

export interface UseScanPollingReturn {
  /** 현재 스캔 상태 */
  status: ScanStatusResponse | null;
  /** UI 표시용 상태 */
  uiState: ScanUIState;
  /** 폴링 진행 중 여부 */
  isPolling: boolean;
  /** 로딩 상태 (초기 로드) */
  loading: boolean;
  /** 에러 객체 */
  error: Error | null;
  /** 상태 수동 새로고침 */
  refresh: () => Promise<void>;
  /** 폴링 시작 */
  startPolling: () => void;
  /** 폴링 중지 */
  stopPolling: () => void;
}

// ===== Helper Functions =====

/**
 * ScanStatusResponse를 기반으로 UI 상태를 계산
 */
const computeUIState = (status: ScanStatusResponse | null): ScanUIState => {
  if (!status) return 'IDLE';

  // 스캔 진행 중
  if (status.isScanning) {
    return 'IN_PROGRESS';
  }

  // 쿨다운 상태 (canScan === false이고 reason에 "초 후" 포함)
  if (!status.canScan && status.canScanReason?.includes('초 후')) {
    return 'COOLDOWN';
  }

  // 마지막 완료된 스캔 결과 존재
  if (status.lastCompletedScan?.result) {
    return 'COMPLETED';
  }

  // 마지막 스캔이 실패한 경우
  if (status.currentScan?.status === 'FAILED') {
    return 'FAILED';
  }

  return 'IDLE';
};

// ===== Hook =====

/**
 * 스캔 상태 폴링 훅
 *
 * @example
 * const { status, uiState, refresh } = useScanPolling(projectId, {
 *   onScanComplete: (status) => {
 *     toast.success('스캔이 완료되었습니다.');
 *     refetchResources();
 *   },
 * });
 */
export const useScanPolling = (
  projectId: string,
  options: UseScanPollingOptions = {}
): UseScanPollingReturn => {
  const { interval = 2000, onScanComplete, onError, autoStart = true } = options;

  const [status, setStatus] = useState<ScanStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Refs for cleanup and state tracking
  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsScanningRef = useRef<boolean | null>(null);

  // 콜백을 ref로 관리하여 의존성 배열 문제 해결
  const onScanCompleteRef = useRef(onScanComplete);
  const onErrorRef = useRef(onError);

  // 콜백 ref 업데이트
  useEffect(() => {
    onScanCompleteRef.current = onScanComplete;
    onErrorRef.current = onError;
  }, [onScanComplete, onError]);

  // 스캔 상태 조회
  const fetchStatus = useCallback(async (): Promise<ScanStatusResponse | null> => {
    try {
      const data = await getScanStatus(projectId);

      if (!mountedRef.current) return null;

      setStatus(data);
      setError(null);

      // 완료 감지: 이전에 스캔 중이었는데 현재는 아닌 경우
      if (prevIsScanningRef.current === true && !data.isScanning) {
        onScanCompleteRef.current?.();
      }
      prevIsScanningRef.current = data.isScanning;

      return data;
    } catch (err) {
      if (!mountedRef.current) return null;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onErrorRef.current?.(error);
      return null;
    }
  }, [projectId]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // 이미 폴링 중

    setIsPolling(true);
    pollingRef.current = setInterval(async () => {
      const data = await fetchStatus();

      // 스캔이 완료되면 폴링 중지
      if (data && !data.isScanning) {
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
    const data = await fetchStatus();
    setLoading(false);

    // 스캔 진행 중이면 폴링 시작
    if (data?.isScanning && !pollingRef.current) {
      startPolling();
    }
  }, [fetchStatus, startPolling]);

  // 초기 로드 - projectId만 의존성으로
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
        const data = await getScanStatus(projectId);

        if (isCancelled || !mountedRef.current) return;

        setStatus(data);
        prevIsScanningRef.current = data.isScanning;

        // 스캔 진행 중이면 자동으로 폴링 시작
        if (data.isScanning && !pollingRef.current) {
          setIsPolling(true);
          pollingRef.current = setInterval(async () => {
            const newData = await getScanStatus(projectId);
            if (!mountedRef.current) return;

            setStatus(newData);

            // 완료 감지
            if (prevIsScanningRef.current === true && !newData.isScanning) {
              onScanCompleteRef.current?.();
            }
            prevIsScanningRef.current = newData.isScanning;

            // 스캔 완료 시 폴링 중지
            if (!newData.isScanning) {
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
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onErrorRef.current?.(error);
        }
      } finally {
        if (!isCancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    init();

    // Cleanup
    return () => {
      isCancelled = true;
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [projectId, autoStart, interval]);

  // UI 상태 계산
  const uiState = computeUIState(status);

  return {
    status,
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
