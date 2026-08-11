'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import {
  getProject,
  resetTargetSource,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { useApiMutation } from '@/app/hooks/useApiMutation';
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

interface RewindArgs {
  kind: ConfirmRewindKind;
  reason: string;
}

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
 * 뮤테이션은 저장소 규칙대로 useApiMutation 이 돈다(AGENTS.md). 다만 기본 토스트는 끈다
 * (`suppressAlert`): 이 화면은 실패를 두 가지로 갈라 말해야 하는데 훅의 한 문장으로는
 * 그 구분이 안 선다. 성공/실패는 반환값으로 가른다 — 훅은 실패 시 undefined 를 준다.
 */
export const useRewindStep = (
  targetSourceId: number,
  onProjectUpdate: (project: CloudTargetSource) => void,
): RewindStep => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);
  /** 뮤테이션이 끝난 뒤 project 를 다시 읽는 구간 — 훅의 loading 이 이미 내려간 뒤다. */
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 진행 중 표식은 렌더를 기다리지 않는다: state 로만 막으면 같은 틱에 들어온 두 번째 클릭이
   * 아직 false 인 값을 읽고 되돌리기를 두 번 쏜다. 뮤테이션이 끝난 뒤 갱신이 도는 동안에도
   * 계속 잡고 있어야 한다 — 그 사이 화면은 아직 되감기 전 단계(Step 7)를 보여주고 버튼도
   * 살아 있어서, 이미 되돌아간 과제에 두 번째 되돌리기가 나갈 수 있다.
   */
  const inFlightRef = useRef(false);

  const rewind = useMemo(
    () =>
      async ({ kind, reason }: RewindArgs) => {
        if (kind === 'infra') await resetTargetSource(targetSourceId, reason);
        else await updateTestConnectionConfirmation(targetSourceId, false);
        // 성공을 값으로 돌려준다 — 훅은 실패했을 때만 undefined 를 주므로, 이 sentinel 이
        // 있어야 void 성공과 실패가 구분된다.
        return true as const;
      },
    [targetSourceId],
  );

  const { mutate, loading } = useApiMutation<RewindArgs, true>(rewind, { suppressAlert: true });

  const confirm = useCallback(
    async (kind: ConfirmRewindKind, reason: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const ok = await mutate({ kind, reason });
        if (!ok) {
          // 되돌리기 자체가 안 나갔다 — 대화상자는 열어 둔다. 다시 누르는 것이 옳은 행동이다.
          toast.error(FAILURE_MESSAGE[kind]);
          return;
        }

        // 여기부터는 서버에 이미 반영된 뒤다. 갱신이 실패해도 되돌리기는 되돌아간 것이므로
        // 대화상자는 닫고, 실패는 "갱신 실패"라고 따로 말한다 — 같은 문장으로 합치면 사용자가
        // 되돌리기를 한 번 더 누른다.
        setConfirmKind(null);
        setRefreshing(true);
        try {
          onProjectUpdate(await getProject(targetSourceId));
        } catch {
          toast.error(REFRESH_FAILURE_MESSAGE[kind]);
        } finally {
          setRefreshing(false);
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [mutate, targetSourceId, onProjectUpdate, toast],
  );

  const pending = loading || refreshing;

  return {
    confirmKind,
    open: setConfirmKind,
    close: () => (pending ? undefined : setConfirmKind(null)),
    pending,
    confirm,
  };
};
