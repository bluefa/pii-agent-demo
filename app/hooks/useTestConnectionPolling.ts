import { useCallback, useRef, useState } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
} from '@/app/lib/api';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { AppError } from '@/lib/errors';
import { usePollingBase } from '@/app/hooks/usePollingBase';

export type TestConnectionUIState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionVersionResult | null;
  uiState: TestConnectionUIState;
  loading: boolean;
  triggerError: string | null;
  trigger: () => Promise<void>;
}

// ADR-019: connection_status gains RUNNING — both PENDING and RUNNING are
// in-progress (polling continues); SUCCESS/FAIL settle. Exported for direct
// unit testing of the new enum handling.
export const isInProgress = (status: TestConnectionVersionResult['connectionStatus']): boolean =>
  status === 'PENDING' || status === 'RUNNING';

export const computeUIState = (job: TestConnectionVersionResult | null): TestConnectionUIState => {
  if (!job) return 'IDLE';
  switch (job.connectionStatus) {
    case 'PENDING':
    case 'RUNNING':
      return 'PENDING';
    case 'SUCCESS': return 'SUCCESS';
    case 'FAIL': return 'FAIL';
    default: return 'IDLE';
  }
};

// Stop polling once there is no job or it has settled (not PENDING/RUNNING).
export const shouldStopPolling = (job: TestConnectionVersionResult | null): boolean =>
  !job || !isInProgress(job.connectionStatus);

const fetchLatestTest = async (
  targetSourceId: number,
): Promise<TestConnectionVersionResult | null> => {
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
    (job: TestConnectionVersionResult | null) => shouldStopPolling(job),
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
  } = usePollingBase<TestConnectionVersionResult | null>({
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

  return {
    latestJob,
    uiState,
    loading,
    triggerError,
    trigger,
  };
};
