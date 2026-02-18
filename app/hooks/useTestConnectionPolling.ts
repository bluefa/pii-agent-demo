import { useState, useEffect, useCallback, useRef } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
  getTestConnectionLastSuccess,
} from '@/app/lib/api';
import type { TestConnectionJob } from '@/app/lib/api';
import type { AppError } from '@/lib/errors';

// ===== Types =====

export type TestConnectionUIState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingOptions {
  /** 폴링 간격 (ms). 기본값 4000 */
  interval?: number;
  /** 완료 시 콜백 */
  onComplete?: (job: TestConnectionJob) => void;
  /** 에러 콜백 */
  onError?: (error: AppError) => void;
}

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionJob | null;
  lastSuccessJob: TestConnectionJob | null;
  uiState: TestConnectionUIState;
  isPolling: boolean;
  loading: boolean;
  triggerError: string | null;
  hasHistory: boolean;
  trigger: () => Promise<void>;
}

// ===== Hook =====

export const useTestConnectionPolling = (
  targetSourceId: number,
  options: UseTestConnectionPollingOptions = {},
): UseTestConnectionPollingReturn => {
  const { interval = 4_000, onComplete, onError } = options;

  const [latestJob, setLatestJob] = useState<TestConnectionJob | null>(null);
  const [lastSuccessJob, setLastSuccessJob] = useState<TestConnectionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<TestConnectionJob['status'] | null>(null);

  // 콜백 refs
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // latest 조회
  const fetchLatest = useCallback(async (): Promise<TestConnectionJob | null> => {
    try {
      const job = await getTestConnectionLatest(targetSourceId);
      if (!mountedRef.current) return null;

      setLatestJob(job);

      // PENDING→완료 전환 감지
      if (prevStatusRef.current === 'PENDING' && job.status !== 'PENDING') {
        onCompleteRef.current?.(job);
        // 성공이면 lastSuccess도 갱신
        if (job.status === 'SUCCESS') {
          setLastSuccessJob(job);
        }
      }
      prevStatusRef.current = job.status;
      return job;
    } catch (err) {
      if (!mountedRef.current) return null;
      const appErr = err as AppError;
      if (appErr.code === 'NOT_FOUND') {
        setLatestJob(null);
        return null;
      }
      onErrorRef.current?.(appErr);
      return null;
    }
  }, [targetSourceId]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    setIsPolling(true);

    pollingRef.current = setInterval(async () => {
      const job = await fetchLatest();
      if (job && job.status !== 'PENDING') {
        stopPolling();
      }
    }, interval);
  }, [fetchLatest, interval, stopPolling]);

  // 트리거
  const trigger = useCallback(async () => {
    setTriggerError(null);
    try {
      await triggerTestConnection(targetSourceId);
      // trigger 후 즉시 latest 조회 → PENDING 상태 세팅
      const job = await fetchLatest();
      if (job?.status === 'PENDING') {
        prevStatusRef.current = 'PENDING';
        startPolling();
      }
    } catch (err) {
      const appErr = err as AppError;
      if (appErr.status === 409) {
        setTriggerError('이미 진행 중인 테스트가 있습니다');
        // 409면 이미 PENDING → polling 시작
        const job = await fetchLatest();
        if (job?.status === 'PENDING') {
          prevStatusRef.current = 'PENDING';
          startPolling();
        }
      } else {
        setTriggerError(appErr.message || '연결 테스트 실행에 실패했습니다');
      }
    }
  }, [targetSourceId, fetchLatest, startPolling]);

  // 초기 로드
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const init = async () => {
      setLoading(true);

      // 병렬 조회
      const [latestResult, lastSuccessResult] = await Promise.allSettled([
        getTestConnectionLatest(targetSourceId),
        getTestConnectionLastSuccess(targetSourceId),
      ]);

      if (cancelled || !mountedRef.current) return;

      // latest
      if (latestResult.status === 'fulfilled') {
        const job = latestResult.value;
        setLatestJob(job);
        prevStatusRef.current = job.status;

        // 진행 중이면 자동 polling
        if (job.status === 'PENDING' && !pollingRef.current) {
          setIsPolling(true);
          pollingRef.current = setInterval(async () => {
            const newJob = await fetchLatest();
            if (newJob && newJob.status !== 'PENDING') {
              stopPolling();
            }
          }, interval);
        }
      } else {
        // 404 등 → 이력 없음
        setLatestJob(null);
      }

      // lastSuccess
      if (lastSuccessResult.status === 'fulfilled') {
        setLastSuccessJob(lastSuccessResult.value);
      } else {
        setLastSuccessJob(null);
      }

      setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [targetSourceId, interval, fetchLatest, stopPolling]);

  // UI 상태 계산
  const uiState: TestConnectionUIState = (() => {
    if (!latestJob) return 'IDLE';
    switch (latestJob.status) {
      case 'PENDING': return 'PENDING';
      case 'SUCCESS': return 'SUCCESS';
      case 'FAIL': return 'FAIL';
      default: return 'IDLE';
    }
  })();

  const hasHistory = latestJob !== null;

  return {
    latestJob,
    lastSuccessJob,
    uiState,
    isPolling,
    loading,
    triggerError,
    hasHistory,
    trigger,
  };
};
