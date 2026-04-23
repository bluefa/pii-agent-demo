import { useCallback, useRef, useState } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
} from '@/app/lib/api';
import type { TestConnectionJob } from '@/app/lib/api';
import type { AppError } from '@/lib/errors';
import { usePollingBase } from '@/app/hooks/usePollingBase';

export type TestConnectionUIState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionJob | null;
  uiState: TestConnectionUIState;
  loading: boolean;
  triggerError: string | null;
  hasHistory: boolean;
  trigger: () => Promise<void>;
}

const computeUIState = (job: TestConnectionJob | null): TestConnectionUIState => {
  if (!job) return 'IDLE';
  switch (job.status) {
    case 'PENDING': return 'PENDING';
    case 'SUCCESS': return 'SUCCESS';
    case 'FAIL': return 'FAIL';
    default: return 'IDLE';
  }
};

const fetchLatestTest = async (
  targetSourceId: number,
): Promise<TestConnectionJob | null> => {
  try {
    return await getTestConnectionLatest(targetSourceId);
  } catch {
    return null;
  }
};

export const useTestConnectionPolling = (
  targetSourceId: number,
  interval = 4_000,
): UseTestConnectionPollingReturn => {
  const [loading, setLoading] = useState(true);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const firstFetchRef = useRef(true);

  const fetchOnce = useCallback(
    () => fetchLatestTest(targetSourceId),
    [targetSourceId],
  );

  const shouldStop = useCallback(
    (job: TestConnectionJob | null) => !job || job.status !== 'PENDING',
    [],
  );

  const handleUpdate = useCallback(() => {
    if (firstFetchRef.current) {
      firstFetchRef.current = false;
      setLoading(false);
    }
  }, []);

  const {
    data: latestJob,
    refresh: baseRefresh,
    start,
  } = usePollingBase<TestConnectionJob | null>({
    interval,
    fetchOnce,
    shouldStop,
    onUpdate: handleUpdate,
  });

  const trigger = useCallback(async () => {
    setTriggerError(null);
    try {
      await triggerTestConnection(targetSourceId);
    } catch (err) {
      const appErr = err as AppError;
      if (appErr.status === 409) {
        setTriggerError('이미 진행 중인 테스트가 있습니다');
      } else {
        setTriggerError(appErr.message || '연결 테스트 실행에 실패했습니다');
        return;
      }
    }
    await baseRefresh();
    start();
  }, [targetSourceId, baseRefresh, start]);

  const uiState = computeUIState(latestJob);
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
