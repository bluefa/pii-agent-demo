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
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY, type IdcCopy } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';
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

const resultFrames = (t: IdcCopy): Record<'success' | 'error', ConfirmStepResult> => ({
  success: {
    kind: 'success',
    title: t.approvalSentTitle,
    description: t.reqApprovalSuccessDesc,
  },
  error: {
    kind: 'error',
    title: t.approvalSendFailedTitle,
    description: t.reqApprovalErrorDesc,
  },
});

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
  const { locale } = useLocale();
  const t = IDC_COPY[locale];
  const frames = resultFrames(t);
  // 클라우드 모달과 같은 출처. 비어 있다는 것은 아직 못 읽었거나 이번 실행이 말하지
  // 않았다는 뜻이고, 둘 다 0 이 아니다 — 셀이 `—` 를 찍는다.
  const [counts, setCounts] = useState<LogicalDbCountMap>(() => new Map());
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, 'latest', {
      signal: controller.signal,
    })
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
  const failure = approvalFailureCopy(errorCode, locale);

  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      // `confirmDisabled` 는 두지 않는다. 카드 CTA 가 `buckets.ok === liveResources.length` 로
      // 잠그고 자격 증명이 바뀌면 `credsDirty` 가 다시 잠그므로, 이 모달이 열려 있는 동안
      // 대기 행은 존재할 수 없다 — 클라우드 모달에도 같은 게이트가 없다. 도달하지 못하는
      // 경우를 막는 코드는 두지 않고(CLAUDE.md §2), 특히 이유를 말하지 않는 잠긴 버튼은
      // 두지 않는다: 그 상태에 빠진 사용자는 무엇을 고쳐야 하는지 알 길이 없다.
      result={
        phase === 'success'
          ? frames.success
          : phase === 'error'
            ? { ...frames.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title={t.reqApprovalTitle}
      description={
        <>
          <span className={primaryColors.text}>{t.reqApprovalDescEm(total)}</span>
          {t.reqApprovalDescAfter}
        </>
      }
      confirmLabel={t.request}
      size="lg"
    >
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={t.statTargets} value={total} unit={t.unitCount} scale="dialog" />
        <StatTile label={t.statConnOk} value={ok} unit={t.unitCount} scale="dialog" />
        <StatTile label={t.statConnWaiting} value={waiting} unit={t.unitCount} scale="dialog" />
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
