'use client';

import { useEffect, useState } from 'react';
import { primaryColors } from '@/lib/theme';
import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import { approvalFailureCopy } from '@/app/components/ui/confirm-failures';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import { getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import { StatTile } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';
import type { IdcResourceView } from '@/app/lib/api/idc';
import type { AppErrorCode } from '@/lib/errors';

interface IdcReqApprovalModalProps {
  isOpen: boolean;
  targetSourceId: number;
  resources: readonly IdcResourceView[];
  /** 지금 그릴 프레임 (useConfirmSubmit). */
  phase: ConfirmSubmitPhase;
  pending: boolean;
  errorCode?: AppErrorCode;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const RESULTS: Record<'success' | 'error', ConfirmStepResult> = {
  success: {
    kind: 'success',
    title: '승인 요청을 보냈어요',
    description: '잠시 후 관리자 승인 대기 단계로 이동해요.',
  },
  error: {
    kind: 'error',
    title: '승인 요청을 보내지 못했어요',
    description: '연결 테스트 결과와 논리 DB 설정은 그대로 남아 있어요.',
  },
};

/**
 * IDC 완료 승인 요청 — 클라우드(CloudReqApprovalModal)·1단계 승인 요청과 같은 확인 문법이다.
 *
 * 표는 5단계가 쓰는 `IdcResourceTable` 그대로다. 손으로 뜬 표를 따로 두었을 때는 같은 판정을
 * 두 어휘로 말했고(모달 Success/Fail vs 5단계 표 성공/실패), 논리 DB 구성은 5단계 표에만
 * 있었다 — 승인의 근거인데 승인 화면에는 없었다.
 */
export const IdcReqApprovalModal = ({
  isOpen,
  targetSourceId,
  resources,
  phase,
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: IdcReqApprovalModalProps) => {
  // 클라우드 모달과 같은 출처. 비어 있다는 것은 아직 못 읽었거나 이번 실행이 말하지
  // 않았다는 뜻이고, 둘 다 0 이 아니다 — 셀이 `—` 를 찍는다.
  const [counts, setCounts] = useState<LogicalDbCountMap>(() => new Map());
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setCounts(buildLogicalDbCountMap(summaries));
      })
      .catch(() => {
        // 조회 실패는 빈 결과가 아니다 — 맵을 비운 채 둬서 모든 수가 `—` 로 남는다.
      });
    return () => controller.abort();
  }, [isOpen, targetSourceId]);

  const live = resources.filter((r) => !r.excluded);
  const total = live.length;
  const ok = live.filter((r) => !!r.credentialId && r.connection === 'SUCCESS').length;
  const waiting = total - ok;
  const failure = approvalFailureCopy(errorCode);

  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      // 카드의 CTA 가 이미 막지만, 모달이 스스로도 막는다 — 열려 있는 사이에 자격 증명이
      // 바뀌면 카드의 게이트는 다음 렌더에나 반영된다.
      confirmDisabled={waiting > 0}
      result={
        phase === 'success'
          ? RESULTS.success
          : phase === 'error'
            ? { ...RESULTS.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title="연동 완료 승인을 요청할까요?"
      description={
        <>
          <span className={primaryColors.text}>
            수동 등록한 연동 대상 {total}건의 연결 테스트 결과로 완료 승인을 요청해요
          </span>
          . 요청 후에는 관리자 검토가 시작되고, 변경하려면 요청을 취소하고 다시 제출해야 해요.
        </>
      }
      confirmLabel="요청하기"
      size="lg"
    >
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="연동 대상" value={total} unit="건" scale="dialog" />
        <StatTile label="연결 성공" value={ok} unit="건" scale="dialog" />
        <StatTile label="연결 대기" value={waiting} unit="건" scale="dialog" />
      </div>

      <div className="mt-4">
        <IdcResourceTable
          resources={live}
          // 5단계 표의 네 열 중 논리 DB 둘만. 클라우드 모달과 같은 모양이다 —
          // 정체성 · 종류 · 논리 DB 구성.
          //
          // 연결 상태를 뺀 것은 자리 때문만이 아니다. 여섯 열은 712px 안에서 `연동 제외`
          // 를 43px 로 눌러 머리글이 세로로 쪼개졌지만, 애초에 이 모달은 **모두 성공했을
          // 때만 열린다**(카드 CTA 가 `buckets.ok === live.length` 로 잠근다). 판정은
          // 위의 타일이 세고, 표는 확정될 구성을 보여준다.
          //
          // `onLogicalOpen` 을 주지 않으므로 수는 평문이다. 확인 모달 위에 또 모달을 얹지
          // 않는다 — 고칠 곳은 뒤의 표다.
          cols={['logicalro']}
          logicalDbCounts={counts}
        />
      </div>
    </ConfirmStepModal>
  );
};
