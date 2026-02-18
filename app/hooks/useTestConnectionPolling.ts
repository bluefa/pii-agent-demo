import { useState, useEffect, useCallback, useRef } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
} from '@/app/lib/api';
import type { TestConnectionJob } from '@/app/lib/api';
import type { AppError } from '@/lib/errors';

// ===== Types =====

export type TestConnectionUIState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionJob | null;
  uiState: TestConnectionUIState;
  loading: boolean;
  triggerError: string | null;
  hasHistory: boolean;
  trigger: () => Promise<void>;
}

// ===== Hook =====

export const useTestConnectionPolling = (
  targetSourceId: number,
  interval = 4_000,
): UseTestConnectionPollingReturn => {
  const [latestJob, setLatestJob] = useState<TestConnectionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<TestConnectionJob['status'] | null>(null);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // latest 조회
  const fetchLatest = useCallback(async (): Promise<TestConnectionJob | null> => {
    try {
      const job = await getTestConnectionLatest(targetSourceId);
      if (!mountedRef.current) return null;

      setLatestJob(job);
      prevStatusRef.current = job.status;
      return job;
    } catch (err) {
      if (!mountedRef.current) return null;
      const appErr = err as AppError;
      if (appErr.code === 'NOT_FOUND') {
        setLatestJob(null);
        return null;
      }
      return null;
    }
  }, [targetSourceId]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;

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

      try {
        const job = await getTestConnectionLatest(targetSourceId);
        if (cancelled || !mountedRef.current) return;

        setLatestJob(job);
        prevStatusRef.current = job.status;

        // 진행 중이면 자동 polling
        if (job.status === 'PENDING') {
          startPolling();
        }
      } catch {
        // 404 등 → 이력 없음
        if (!cancelled) setLatestJob(null);
      }

      if (!cancelled) setLoading(false);
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
  }, [targetSourceId, interval, fetchLatest, startPolling, stopPolling]);

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
    uiState,
    loading,
    triggerError,
    hasHistory,
    trigger,
  };
};
