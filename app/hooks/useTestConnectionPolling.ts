import { useCallback, useRef, useState } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
} from '@/app/lib/api';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { usePollingBase } from '@/app/hooks/usePollingBase';

export type TestConnectionUIState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionVersionResult | null;
  uiState: TestConnectionUIState;
  loading: boolean;
  /** Latest-result fetch failure. NOT_FOUND is excluded — that is the legitimate "no test yet" state. */
  fetchError: AppError | null;
  triggerError: string | null;
  trigger: () => Promise<void>;
}

// ADR-019: connection_status gains RUNNING — both PENDING and RUNNING are
// in-progress (polling continues); SUCCESS/FAIL settle. Exported for direct
// unit testing of the new enum handling.
export const isInProgress = (status: TestConnectionVersionResult['connection_status']): boolean =>
  status === 'PENDING' || status === 'RUNNING';

export const computeUIState = (job: TestConnectionVersionResult | null): TestConnectionUIState => {
  if (!job) return 'IDLE';
  switch (job.connection_status) {
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
  !job || !isInProgress(job.connection_status);

// Only NOT_FOUND means "no test yet" (legitimate IDLE); every other failure
// must surface instead of masquerading as an idle state. Exported for tests.
export const fetchLatestTest = async (
  targetSourceId: number,
): Promise<TestConnectionVersionResult | null> => {
  try {
    return await getTestConnectionLatest(targetSourceId);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') return null;
    throw err;
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
    error: baseError,
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
    // A failed first fetch must still end the loading state — otherwise the
    // panel shows an infinite spinner instead of the error.
    loading: loading && baseError === null,
    fetchError: baseError as AppError | null,
    triggerError,
    trigger,
  };
};
