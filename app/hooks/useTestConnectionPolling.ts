import { useCallback, useRef, useState } from 'react';
import {
  triggerTestConnection,
  getTestConnectionLatest,
} from '@/app/lib/api';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { usePollingBase } from '@/app/hooks/usePollingBase';

// QUEUED(접수됨, 아직 아무것도 안 돎)와 RUNNING(실제 진행)은 다른 프레임이다 — 예전엔
// 둘을 'PENDING' 하나로 접어서 top-level PENDING 이 "진행 중 0%"로 그려졌다.
export type TestConnectionUIState = 'IDLE' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAIL';

export interface UseTestConnectionPollingReturn {
  latestJob: TestConnectionVersionResult | null;
  uiState: TestConnectionUIState;
  loading: boolean;
  /** Latest-result fetch failure. NOT_FOUND is excluded — that is the legitimate "no test yet" state. */
  fetchError: AppError | null;
  triggerError: string | null;
  /** 실행 시작 요청이 떠 있는 동안 true — 버튼 라벨이 "진행 중"으로 바뀌는 근거. */
  triggering: boolean;
  /**
   * 실행을 시작해도 되는가. 화면은 이 값 하나만 보면 된다 — loading·fetchError·triggering·
   * uiState 를 호출부에서 조립하면 화면마다 항을 빠뜨리고, 빠뜨린 항이 곧 "아직 모르는데
   * 누를 수 있는" 창이 된다. 이 브랜치의 결함 대부분이 그 창이었다.
   */
  canRunTest: boolean;
  /**
   * 조회 실패로 멈춘 폴링을 다시 세운다. 잠금이 조회 성공으로만 풀리므로, 조회가 계속
   * 실패하면 이 길이 없이는 버튼이 영영 돌아오지 않는다.
   */
  retry: () => Promise<void>;
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
    case 'PENDING': return 'QUEUED';
    case 'RUNNING': return 'RUNNING';
    case 'SUCCESS': return 'SUCCESS';
    case 'FAIL': return 'FAIL';
    default: return 'IDLE';
  }
};

/**
 * uiState 기준의 "실행이 떠 있다"(시작 대기 포함) — 카드의 testing 게이트와 이 훅의
 * canRunTest 가 같은 한 사실을 쓴다. 호출부가 두 값을 직접 비교해 조립하면 QUEUED 를
 * 빠뜨린 자리가 곧 "대기 중인데 누를 수 있는" 창이 된다.
 */
export const isInFlightUi = (uiState: TestConnectionUIState): boolean =>
  uiState === 'QUEUED' || uiState === 'RUNNING';

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
  const [triggering, setTriggering] = useState(false);
  const firstFetchRef = useRef(true);
  /**
   * 마지막 조회가 성공했는가. 이것이 canRunTest 의 뼈대다 — `latestJob` 만 보면 "성공했는데
   * 실행이 없다(null)"와 "조회를 못 했다"가 같은 모양이 되고, 그 둘은 정반대의 답을 요구한다.
   */
  const [observed, setObserved] = useState(false);

  const fetchOnce = useCallback(
    () => fetchLatestTest(targetSourceId),
    [targetSourceId],
  );

  const shouldStop = useCallback(
    (job: TestConnectionVersionResult | null) => shouldStopPolling(job),
    [],
  );

  /**
   * 조회가 성공했을 때만 불린다(usePollingBase). 그래서 "봤다"라고 말할 수 있는 유일한 자리이고,
   * 실행 잠금도 여기서 푼다 — 요청이 끝난 시점이 아니라 새 데이터를 실제로 본 시점에.
   * refresh 는 조회 실패를 삼키고 그냥 반환하므로, 요청 종료로 풀면 POST 는 성공했는데 조회만
   * 실패한 경우 새 실행을 한 번도 못 본 채 버튼이 열린다.
   */
  const handleUpdate = useCallback(() => {
    firstFetchRef.current = false;
    setLoading(false);
    setObserved(true);
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

  const trigger = useCallback(async (): Promise<boolean> => {
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
        // 응답을 못 받은 실패(NETWORK·TIMEOUT)는 서버가 요청을 받지 않았다는 증거가 아니다 —
        // 잠금을 여기서 풀지 않고, 조회가 실제로 무엇이 있는지 말해 줄 때까지 기다린다.
        setTriggering(false);
        await baseRefresh();
        start();
        return false;
      }
    }
    // 잠금과 observed 는 handleUpdate 가 푼다(조회 성공 시에만). 실패하면 잠긴 채로 남고,
    // start() 가 계속 돌아 다음 성공한 폴에서 풀린다 — 그때까지 잠겨 있는 것이 옳다.
    await baseRefresh();
    start();
    return started;
  }, [targetSourceId, baseRefresh, start]);

  /** 조회 실패로 멈춘 폴링을 사용자가 다시 세우는 길 — 잠금이 영영 안 풀리는 것을 막는 유일한 출구. */
  const retry = useCallback(async () => {
    await baseRefresh();
    start();
  }, [baseRefresh, start]);

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
    /**
     * 실행을 시작해도 되는가 — 호출부가 조건을 조립하지 않도록 한 사실로 답한다. 조립하게 두면
     * 화면마다 항을 하나씩 빠뜨리고, 실제로 그렇게 빠뜨린 항이 이 브랜치의 결함 대부분이었다.
     * 참이 되는 조건은 하나뿐이다: 마지막 조회가 성공했고(=지금 상태를 안다), 그 조회가 말한
     * 실행이 끝나 있다.
     */
    canRunTest: observed && baseError === null && !triggering && !isInFlightUi(uiState),
    retry,
    trigger,
  };
};
