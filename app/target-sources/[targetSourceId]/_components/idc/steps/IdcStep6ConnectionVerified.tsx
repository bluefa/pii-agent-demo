'use client';

import { useEffect, useState } from 'react';
import { cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useToast } from '@/app/components/ui/toast';
import { ErrorState } from '@/app/components/ui/state';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmRewindModal,
  type ConfirmRewindKind,
} from '@/app/target-sources/[targetSourceId]/_components/layout/ConfirmRewindModal';
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { LogicalDbSummaryModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbSummaryModal';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import {
  getLatestTestConnectionResultSummaries,
  getProject,
  updateTestConnectionConfirmation,
} from '@/app/lib/api';
import { getIdcConfirmedResources, type IdcResourceView } from '@/app/lib/api/idc';
import { useIdcResources } from '@/app/hooks/useIdcResources';

/** 연결 재확인 — opens the confirm-rewind modal (mirrors the cloud sibling). */
const ConnectionVerifiedRetestButton = ({
  targetSourceId,
  onProjectUpdate,
}: {
  targetSourceId: number;
  onProjectUpdate: IdcStepProps['onProjectUpdate'];
}) => {
  const toast = useToast();
  const [confirmKind, setConfirmKind] = useState<ConfirmRewindKind | null>(null);

  // 되돌아가기: roll back the completion acknowledgment (confirmed:false). The mock
  // clears passedAt → the project returns to Step 5 (WAITING_CONNECTION_TEST); the
  // refetch then re-renders the rewound step.
  const handleConfirm = async () => {
    setConfirmKind(null);
    try {
      await updateTestConnectionConfirmation(targetSourceId, false);
      onProjectUpdate(await getProject(targetSourceId));
    } catch {
      toast.error('연결 재확인 요청에 실패했습니다.');
    }
  };

  return (
    <>
      <button
        type="button"
        className={idcStyles.triggerBtn.linkWarn}
        onClick={() => setConfirmKind('retest')}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        연결 재확인
      </button>
      <ConfirmRewindModal
        kind={confirmKind}
        onClose={() => setConfirmKind(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

/**
 * IDC Step 6 — 완료 여부 관리자 승인 대기 (read-only).
 * Same shape as the cloud step: the header carries the step tag, the status badge and the
 * guidance copy, and the table swaps DB Credential / Connection Status for the Step 5
 * logical-DB result. Both dropped columns were placeholders here — the confirmed-integration
 * rows have no connection_status, so every row read "Pending" after a passing test.
 * Each step fetches its own list under its `targetSourceId` (DR3/DR4/DR5/DR7)
 * via the shared `useIdcResources` read hook, never module-level state.
 */
export const IdcStep6ConnectionVerified = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const { targetSourceId } = project;

  // Step 6 source: the confirmed list (confirmed-integration), same as cloud steps 4–7.
  const { state } = useIdcResources(targetSourceId, getIdcConfirmedResources);

  // Step 5 counts for the whole table in one call; the per-resource lists load only on open.
  const [logicalDbCounts, setLogicalDbCounts] = useState<LogicalDbCountMap>(new Map());
  useEffect(() => {
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setLogicalDbCounts(buildLogicalDbCountMap(summaries));
      })
      .catch(() => {
        // No summaries available → leave the map empty so cells render "—".
      });
    return () => controller.abort();
  }, [targetSourceId]);

  // The resource whose logical-DB list is open. null = closed.
  const [logicalTarget, setLogicalTarget] = useState<IdcResourceView | null>(null);

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        {/* Same left-aligned stack as the cloud step: step tag, title + status, guidance copy. */}
        <header className={cardStyles.header}>
          <span
            className={cn(
              'mb-1.5 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[12px] font-bold',
              primaryColors.bgLight,
              primaryColors.textOnLight,
            )}
          >
            6번째 단계
          </span>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className={cardStyles.cardTitle}>완료 여부 관리자 승인 대기</h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                  statusColors.warning.bg,
                  statusColors.warning.textDark,
                )}
              >
                승인 대기
              </span>
            </div>
            {/* C-3: auxiliary retest action pinned to the header right. When to press it is
                explained in the guidance copy below, not in a caption under the button. */}
            <div className="shrink-0">
              <ConnectionVerifiedRetestButton
                targetSourceId={targetSourceId}
                onProjectUpdate={onProjectUpdate}
              />
            </div>
          </div>
          {/* One sentence instead of two: the header subtitle and the info banner said the same
              thing. Blue marks the status clause only, matching steps 2·3. */}
          <p className={cn('mt-3 text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
            <strong className={cn('font-semibold', primaryColors.text)}>
              최종 관리자 승인을 기다리고 있어요.
            </strong>{' '}
            PII Agent 운영팀의 승인이 완료되면 모니터링이 즉시 시작됩니다.
          </p>
          {/* mt 없음 — 행간 여백(leading 1.55)만으로 문단을 가른다 (step 2 문법). */}
          <p className={cn('text-[16px] font-medium leading-[1.55]', textColors.tertiary)}>
            통합 테스트 결과가 잘못됐거나 연결 테스트를 한 번 더 수행하고 싶다면 우측 상단{' '}
            <strong className={cn('font-semibold', textColors.secondary)}>연결 재확인</strong>을
            눌러주세요.
          </p>
        </header>
        <div className={cardStyles.body}>
          {state.status === 'loading' && <ResourceTableSkeleton />}
          {state.status === 'error' && <ErrorState message="연동 대상을 불러오지 못했습니다." />}
          {state.status === 'ready' && (
            <IdcResourceTable
              resources={state.resources}
              cols={['src', 'logicalro']}
              logicalDbCounts={logicalDbCounts}
              onLogicalOpen={setLogicalTarget}
            />
          )}
        </div>
      </section>
      {/* Mounted only while open so the hook fetches on open and drops its state on close. */}
      {logicalTarget && (
        <LogicalDbSummaryModal
          open
          targetSourceId={targetSourceId}
          resourceId={logicalTarget.resourceId}
          resourceName={logicalTarget.hosts[0] ?? logicalTarget.resourceId}
          onClose={() => setLogicalTarget(null)}
        />
      )}
      <RejectionAlert project={project} />
    </>
  );
};
