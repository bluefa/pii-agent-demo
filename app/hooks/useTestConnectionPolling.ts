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
  /**
   * 실행 시작 요청이 떠 있는 동안 true. `uiState === 'PENDING'` 은 이 요청이 끝나고
   * latest_version 이 새 실행을 되돌려준 뒤에야 켜지므로, 그 사이(실서버 왕복만큼)
   * Run Test 버튼은 여전히 눌리는 상태다 — 두 번째 클릭은 409 를 받아 사용자가
   * 부른 적 없는 오류 줄을 띄운다. 버튼은 이 값으로도 잠근다.
   */
  triggering: boolean;
  /**
   * 새 실행 시작을 요청한다. 반환값 = 이번 요청으로 실행이 실제로 시작됐는가 —
   * 409(이미 진행 중)와 그 외 실패는 false. IDC 의 credsDirty 게이트가 "실행이
   * 시작된 뒤에만" 풀리도록 이 사실을 쓴다.
   */
  trigger: () => Promise<boolean>;
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
    // 잠금은 "요청이 끝났을 때"가 아니라 "새 데이터를 실제로 봤을 때" 푼다. usePollingBase 의
    // refresh 는 조회가 실패해도 삼키고 그냥 반환하므로, 요청 종료로 풀면 POST 는 성공했는데
    // 조회만 실패한 경우 아직 새 실행을 한 번도 못 본 채 버튼이 열린다 — 그 상태로 다시 누르면
    // 이 브랜치가 없애려던 409 를 그대로 받는다. onUpdate 는 조회가 성공했을 때만 불린다.
    triggeringRef.current = false;
    setTriggering(false);
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

  const [triggering, setTriggering] = useState(false);
  // 상태만으로는 같은 틱에 들어온 두 번째 클릭을 막지 못한다 — 그 클릭은 아직 false 인
  // 값을 읽는다. 버튼 disabled 도 리렌더를 기다리므로 이것 혼자로는 부족하다.
  const triggeringRef = useRef(false);

  const trigger = useCallback(async (): Promise<boolean> => {
    if (triggeringRef.current) return false;
    triggeringRef.current = true;
    setTriggering(true);
    setTriggerError(null);
    let started = true;
    try {
      await triggerTestConnection(targetSourceId);
    } catch (err) {
      const appErr = err as AppError;
      started = false;
      if (appErr.status === 409) {
        setTriggerError('이미 진행 중인 테스트가 있습니다');
      } else {
        setTriggerError(appErr.message || '연결 테스트 실행에 실패했습니다');
        triggeringRef.current = false;
        setTriggering(false);
        return false;
      }
    }
    // 조회가 성공하면 handleUpdate 가 잠금을 푼다 — 여기서 풀지 않는 이유는 그 콜백의
    // 주석에 있다(조회 실패를 삼키는 refresh 때문). 실패해도 start() 로 폴링이 계속 돌아
    // 다음 성공한 폴에서 풀린다. 그때까지 버튼이 잠겨 있는 것은 옳다 — 서버에 실행을
    // 만들어 놓고도 그것을 아직 못 본 상태이기 때문이다.
    await baseRefresh();
    start();
    return started;
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
    triggering,
    trigger,
  };
};
