'use client';

import { useCallback, useState } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import {
  getProject,
  resetTargetSource,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { useToast } from '@/app/components/ui/toast';
import type { ConfirmRewindKind } from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';

/** 되돌리기가 실패했을 때 — 무엇을 하려다 실패했는지까지 말한다. */
const FAILURE_MESSAGE: Record<ConfirmRewindKind, string> = {
  infra: '인프라 변경(연동 상태 초기화)에 실패했습니다.',
  retest: '연결 테스트 재실행 요청에 실패했습니다.',
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

  const confirm = useCallback(
    async (kind: ConfirmRewindKind, reason: string) => {
      if (pending) return;
      setPending(true);
      try {
        if (kind === 'infra') {
          await resetTargetSource(targetSourceId, reason);
        } else {
          await updateTestConnectionConfirmation(targetSourceId, false);
        }
        setConfirmKind(null);
        onProjectUpdate(await getProject(targetSourceId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : FAILURE_MESSAGE[kind]);
      } finally {
        setPending(false);
      }
    },
    [pending, targetSourceId, onProjectUpdate, toast],
  );

  return {
    confirmKind,
    open: setConfirmKind,
    close: () => (pending ? undefined : setConfirmKind(null)),
    pending,
    confirm,
  };
};
