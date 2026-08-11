'use client';

import { useCallback, useRef, useState } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import {
  getProject,
  resetTargetSource,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { useToast } from '@/app/components/ui/toast';
import type { ConfirmRewindKind } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';

/**
 * 되돌리기가 실패했을 때 — 무엇을 하려다 실패했는지까지 말한다. AppError.message 는
 * 진단용이라 화면에 그대로 싣지 않는다(ADR-008): 사용자가 읽는 문장은 이 표가 소유한다.
 */
const FAILURE_MESSAGE: Record<ConfirmRewindKind, string> = {
  infra: '인프라 변경(연동 상태 초기화)에 실패했습니다.',
  retest: '연결 테스트 재실행 요청에 실패했습니다.',
};

/**
 * 되돌리기는 됐는데 화면만 못 따라간 경우. "실패했습니다"로 뭉뚱그리면 사용자가 다시
 * 누르는데, 그때는 이미 되돌아간 뒤라 두 번째 요청이 엉뚱한 단계에서 나간다.
 */
const REFRESH_FAILURE_MESSAGE: Record<ConfirmRewindKind, string> = {
  infra: '인프라 변경은 처리됐지만 화면을 갱신하지 못했어요. 새로고침해 주세요.',
  retest: '연결 테스트 재실행은 처리됐지만 화면을 갱신하지 못했어요. 새로고침해 주세요.',
};

export interface RewindStep {
  /** 열려 있는 확인 대화상자 (null = 닫힘). */
  confirmKind: ConfirmRewindKind | null;
  open: (kind: ConfirmRewindKind) => void;
  /** 요청 중에는 닫지 않는다 — 중간에 닫으면 결과를 못 본 채 화면만 남는다. */
  close: () => void;
  pending: boolean;
  confirm: (kind: ConfirmRewindKind, reason: string) => Promise<void>;
}

/**
 * Step 7 의 두 되돌리기를 실행한다 — 클라우드(InstallationCompleteStep)와 IDC(IdcStep7Complete)가
 * 같은 두 API 를 부르므로, 부르는 순서와 실패 처리는 한 곳에만 둔다. 화면 껍데기(버튼 모양,
 * 안내 문장)는 각 스텝이 그대로 소유한다.
 *
 * - 인프라 변경 → POST …/reset { reason }: 승인·설치·연결 확인을 모두 버리고 1단계로.
 * - 연결 테스트 재실행 → PUT …/test-connection-acknowledgment { confirmed: false }: 완료
 *   확인을 롤백해 5단계로.
 *
 * 성공하면 project 를 다시 읽어 넘긴다 — 되감긴 단계로 화면이 넘어간 뒤에 대화상자가 닫히고
 * 스피너가 풀리도록 await 한다(ConnectionVerifiedStep 의 되돌리기와 같은 순서).
 */
export const useRewindStep = (
  targetSourceId: number,
  onProjectUpdate: (project: CloudTargetSource) => void,
): RewindStep => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);
  const [pending, setPending] = useState(false);

  // 진행 중 표식은 렌더를 기다리지 않는다: `pending` state 로만 막으면 같은 틱에 들어온 두
  // 번째 클릭이 아직 false 인 값을 읽고 되돌리기를 두 번 쏜다(두 번째는 이미 되감긴 단계에서
  // 나가므로 엉뚱한 것을 되돌린다). 버튼 disabled 도 같은 이유로 이것 혼자로는 부족하다.
  const inFlightRef = useRef(false);

  const confirm = useCallback(
    async (kind: ConfirmRewindKind, reason: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setPending(true);
      try {
        if (kind === 'infra') {
          await resetTargetSource(targetSourceId, reason);
        } else {
          await updateTestConnectionConfirmation(targetSourceId, false);
        }
      } catch {
        // 되돌리기 자체가 안 나갔다 — 대화상자는 열어 둔다. 다시 누르는 것이 옳은 행동이다.
        toast.error(FAILURE_MESSAGE[kind]);
        return;
      } finally {
        inFlightRef.current = false;
        setPending(false);
      }

      // 여기부터는 서버에 이미 반영된 뒤다. 갱신이 실패해도 되돌리기는 되돌아간 것이므로
      // 대화상자는 닫고, 실패는 "갱신 실패"라고 따로 말한다 — 같은 문장으로 합치면 사용자가
      // 되돌리기를 한 번 더 누른다.
      setConfirmKind(null);
      try {
        onProjectUpdate(await getProject(targetSourceId));
      } catch {
        toast.error(REFRESH_FAILURE_MESSAGE[kind]);
      }
    },
    [targetSourceId, onProjectUpdate, toast],
  );

  return {
    confirmKind,
    open: setConfirmKind,
    close: () => (pending ? undefined : setConfirmKind(null)),
    pending,
    confirm,
  };
};
