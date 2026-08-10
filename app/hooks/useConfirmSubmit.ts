'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProcessStatus, normalizeTargetSourceProcessStatus } from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import { ProcessStatus } from '@/lib/types';

/**
 * 모달이 지금 그리는 프레임. **요청 중인지는 여기 없다** — 그건 `pending` 이 따로
 * 들고 있다. 둘을 한 값에 넣으면 "요청 중"이 곧 "확인 화면"이 되어, 실패 프레임에서
 * 다시 요청하는 순간 화면이 확인 화면으로 되돌아갔다가 실패 프레임으로 돌아온다.
 * - `form`: 확인 화면. 아직 아무 결과도 없다.
 * - `success`: 확인 프레임. 체크가 서 있는 동안 화면은 아직 이 단계다.
 * - `error`: 실패 프레임. 모달은 닫히지 않고 재요청 경로를 준다.
 */
export type ConfirmSubmitPhase = 'form' | 'success' | 'error';

/**
 * 확인 프레임이 서 있는 시간. 스캔 완료 프레임(useScanCompletionTransition 의
 * 400ms 정착 + 1,200ms 확인)보다 짧다 — 저쪽은 진행바가 100%에 닿는 것부터
 * 보여줘야 하지만, 여기서 확인할 사건은 "보냈다" 하나뿐이다.
 */
const HOLD_MS = 1000;

interface UseConfirmSubmitOptions {
  targetSourceId: number;
  /** 요청 전송 자체. reject 하면 실패 프레임으로 간다. */
  request: () => Promise<void>;
  /** 확인 프레임이 끝난 뒤 — 화면 갱신(refreshProject)과 모달 정리. */
  settle: () => void | Promise<void>;
}

export interface UseConfirmSubmitReturn {
  phase: ConfirmSubmitPhase;
  /** 요청이 날아가 있는 동안. 프레임은 그대로 두고 버튼만 잠근다. */
  pending: boolean;
  /** 실패 사유 한 줄. 서버가 준 사용자용 메시지일 때만 값이 있다. */
  errorReason?: string;
  submit: () => void;
  retry: () => void;
  /** 실패 프레임의 닫기 — 확인 프레임으로 되돌린다. */
  reset: () => void;
}

/**
 * 요청 → 확인 → 전환의 세 박자를 한 곳에서 돌린다. Step 1 의 승인 요청은 IDC 와
 * 클라우드가 같은 모달(ConfirmStepModal)을 쓰고 같은 실패 모드를 가지므로, 상태
 * 기계도 하나만 둔다.
 *
 * 성공 시 화면 갱신을 곧바로 돌리지 않는 것이 이 훅의 핵심이다: `refreshProject()`
 * 가 상태를 WAITING_APPROVAL 로 바꾸는 순간 Step 1 컴포넌트가 통째로 교체되고,
 * 그 안에 살던 모달은 확인 프레임을 보여주기도 전에 언마운트된다. 갱신은 홀드가
 * 끝난 뒤에 부른다.
 */
export const useConfirmSubmit = ({
  targetSourceId,
  request,
  settle,
}: UseConfirmSubmitOptions): UseConfirmSubmitReturn => {
  const [phase, setPhase] = useState<ConfirmSubmitPhase>('form');
  const [pending, setPending] = useState(false);
  const [errorReason, setErrorReason] = useState<string>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 두 콜백 모두 렌더마다 새로 만들어지는 클로저다 — ref 로 최신 것을 들고 있으면
  // 훅이 돌려주는 핸들러들이 매 렌더 새 identity 를 갖지 않고, 홀드 타이머가 붙잡은
  // settle 도 대기 중에 낡지 않는다.
  const requestRef = useRef(request);
  const settleRef = useRef(settle);
  useEffect(() => {
    requestRef.current = request;
    settleRef.current = settle;
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const succeed = useCallback(() => {
    setPhase('success');
    timerRef.current = setTimeout(() => {
      void settleRef.current();
    }, HOLD_MS);
  }, []);

  const send = useCallback(async () => {
    try {
      await requestRef.current();
      setErrorReason(undefined);
      succeed();
    } catch (error) {
      // 서버가 준 detail 만 그대로 보여준다(AppError.isUserFacing) — 네트워크 스택이
      // 던진 원문("Failed to fetch")은 사용자에게 아무 말도 하지 않으므로, 모달의
      // 기본 문구로 떨어뜨린다.
      setErrorReason(
        error instanceof AppError && error.isUserFacing ? error.message : undefined,
      );
      setPhase('error');
    }
  }, [succeed]);

  /** 프레임은 건드리지 않고 요청 구간만 표시한다 — 이 훅의 두 진입점이 공유하는 껍데기. */
  const run = useCallback((task: () => Promise<void>) => {
    setPending(true);
    void task().finally(() => setPending(false));
  }, []);

  const submit = useCallback(() => run(send), [run, send]);

  const retry = useCallback(
    () =>
      run(async () => {
        // 응답만 실패하고 요청은 이미 접수됐을 수 있다(타임아웃·게이트웨이). 그대로 다시
        // 보내면 승인 요청이 두 건 생기므로, 진행 상태를 먼저 다시 읽는다. 이미 1단계를
        // 벗어나 있으면 재요청 없이 확인 프레임 → 화면 갱신으로 넘긴다.
        try {
          const status = await getProcessStatus(targetSourceId);
          if (
            normalizeTargetSourceProcessStatus(status.process_status)
            !== ProcessStatus.WAITING_TARGET_CONFIRMATION
          ) {
            succeed();
            return;
          }
        } catch {
          // 상태 조회조차 실패하면 판정할 근거가 없다. 조회 실패를 요청 실패로 보고할
          // 수는 없으므로(사용자가 누른 것은 재요청이다) 그대로 재요청으로 진행한다 —
          // 미확정 상태에서 중복을 피하는 유일한 근거가 이 조회였고, 그 근거가 없다.
        }
        await send();
      }),
    [run, targetSourceId, send, succeed],
  );

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setErrorReason(undefined);
    setPhase('form');
  }, []);

  return { phase, pending, errorReason, submit, retry, reset };
};

export default useConfirmSubmit;
