'use client';

import { useCallback, useMemo, useState } from 'react';
import { createApprovalRequest } from '@/app/lib/api';
import { formatDate } from '@/lib/utils/date';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ClockIcon, PlayIcon } from '@/app/components/ui/icons';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { useToast } from '@/app/components/ui/toast';
import { ScanController, type ScanUiState } from '@/app/components/features/scan/ScanPanel';
import { ScanEmptyState } from '@/app/components/features/scan/ScanEmptyState';
import { ScanErrorState } from '@/app/components/features/scan/ScanErrorState';
import { ScanRunningState } from '@/app/components/features/scan/ScanRunningState';
import {
  borderColors,
  cardStyles,
  cn,
  getButtonClass,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { CandidateDraftState, EndpointConfigDraft } from '@/lib/types/resources';
import { CardActionBar } from '@/app/target-sources/[targetSourceId]/_components/common';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';
import type { CandidateRowActions } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';
import { selectPhase, type Phase } from '@/app/target-sources/[targetSourceId]/_components/candidate/phase';
import {
  listMissingExclusionReasons,
  toApprovalRequestInput,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import { useCandidateResources } from '@/app/target-sources/[targetSourceId]/_components/candidate/use-candidate-resources';
import { useExclusionPicker } from '@/app/target-sources/[targetSourceId]/_components/candidate/use-exclusion-picker';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';
import { IdcExclusionPopover } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcExclusionPopover';
import { IdcExclusionReasonModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcExclusionReasonModal';

interface CandidateResourceSectionProps {
  targetSourceId: number;
  readonly: boolean;
  refreshProject: () => Promise<void>;
}

const EMPTY_DRAFTS: CandidateDraftState = { endpointDrafts: {} };

/** Cloud exclusion reason limit — docs/cloud-provider-states.md (required, max 3000 chars). */
const CLOUD_EXCL_REASON_MAXLEN = 3000;

/** Skeleton frame shown while candidate resources load — mirrors the candidate table shape. */
const CandidateTableSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    <div className={cn(idcStyles.skeletonBar, 'h-3.5 w-56 rounded')} />
    <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && cn('border-t', borderColors.light))}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-4 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 flex-1 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-24 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-20 rounded-full')} />
        </div>
      ))}
    </div>
  </div>
);

export const CandidateResourceSection = ({
  targetSourceId,
  readonly,
  refreshProject,
}: CandidateResourceSectionProps) => {
  const toast = useToast();
  const approvalModal = useModal();
  const {
    state,
    candidates,
    selectedIds,
    setSelectedIds,
    exclusions,
    setExclusions,
    refetch,
    refetchAfterScan,
  } = useCandidateResources(targetSourceId);

  const [drafts, setDrafts] = useState<CandidateDraftState>(EMPTY_DRAFTS);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);

  // Plain id→reason map for the payload adapter and the table's reason chips.
  const exclusionReasons = useMemo(
    () => Object.fromEntries(Object.entries(exclusions).map(([id, e]) => [id, e.reason])),
    [exclusions],
  );

  const select = useCallback((resourceId: string) => {
    setSelectedIds((previous) => new Set(previous).add(resourceId));
    setExclusions((previous) => {
      if (!(resourceId in previous)) return previous;
      const next = { ...previous };
      delete next[resourceId];
      return next;
    });
  }, [setSelectedIds, setExclusions]);

  const exclude = useCallback((resourceId: string, reason: string, custom: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(resourceId);
      return next;
    });
    setExclusions((previous) => ({ ...previous, [resourceId]: { reason, custom } }));
  }, [setSelectedIds, setExclusions]);

  const picker = useExclusionPicker({ onSelect: select, onExclude: exclude });
  const { popover, reasonModal, closeAll: closePicker } = picker;

  const approval = useApiAction(
    async () => {
      const input = toApprovalRequestInput(candidates, selectedIds, drafts, exclusionReasons);
      await createApprovalRequest(targetSourceId, input);
      await refreshProject();
    },
    {
      onSuccess: () => {
        approvalModal.close();
        setExpandedResourceId(null);
      },
      suppressAlert: true,
      errorMessage: '승인 요청에 실패했습니다.',
    },
  );

  const handleExpandToggle = useCallback((resourceId: string | null) => {
    setExpandedResourceId(resourceId);
  }, []);

  const handleEndpointSave = useCallback((resourceId: string, draft: EndpointConfigDraft) => {
    setDrafts((previous) => ({
      ...previous,
      endpointDrafts: { ...previous.endpointDrafts, [resourceId]: draft },
    }));
  }, []);

  const rowActions = useMemo<CandidateRowActions>(() => ({
    toggleSelected: picker.handleToggleSelected,
    reasonChipClick: picker.handleReasonChipClick,
    expandToggle: handleExpandToggle,
    endpointSave: handleEndpointSave,
  }), [picker.handleToggleSelected, picker.handleReasonChipClick, handleExpandToggle, handleEndpointSave]);

  const handleRequestApproval = useCallback(() => {
    if (selectedIds.size === 0) return;
    const unconfigured = candidates.filter(
      (candidate) => selectedIds.has(candidate.id)
        && !getCandidateBehavior(candidate).isConfigured(candidate, drafts),
    );
    if (unconfigured.length > 0) {
      toast.warning(
        `다음 리소스의 설정이 필요합니다: ${unconfigured.map((candidate) => candidate.resourceId).join(', ')}`,
      );
      return;
    }
    // Exclusion reason is required (docs/cloud-provider-states.md) — every unselected TARGET needs one.
    const missingReasons = listMissingExclusionReasons(candidates, selectedIds, exclusionReasons);
    if (missingReasons.length > 0) {
      toast.warning(
        `제외 사유 입력이 필요합니다: ${missingReasons.map((candidate) => candidate.resourceId).join(', ')}`,
      );
      return;
    }
    approval.reset();
    approvalModal.open();
  }, [approval, approvalModal, candidates, drafts, exclusionReasons, selectedIds, toast]);

  const handleScanComplete = useCallback(async () => {
    setDrafts(EMPTY_DRAFTS);
    setExpandedResourceId(null);
    closePicker();
    refetchAfterScan();
    await refreshProject();
  }, [closePicker, refetchAfterScan, refreshProject]);

  const handleApprovalConfirm = useCallback(() => {
    void approval.execute();
  }, [approval]);

  const renderBody = (phase: Phase, progress: number, startScan: () => void) => {
    const errorMessage = state.status === 'error' ? state.message : '';

    switch (phase) {
      case 'fetching':
        return <CandidateTableSkeleton />;
      case 'fetchError':
        return (
          <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
            <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{errorMessage}</p>
            <button onClick={refetch} className={getButtonClass('secondary')}>
              다시 시도
            </button>
          </div>
        );
      case 'scanning':
        return <ScanRunningState progress={progress} />;
      case 'scanFailed':
        return <ScanErrorState onRetry={startScan} />;
      case 'list':
        return (
          <CandidateResourceTable
            candidates={candidates}
            selectedIds={selectedIds}
            exclusionReasons={exclusionReasons}
            drafts={drafts}
            expandedResourceId={expandedResourceId}
            readonly={readonly}
            actions={rowActions}
          />
        );
      case 'empty':
        return <ScanEmptyState />;
      default:
        phase satisfies never;
        return null;
    }
  };

  return (
    <>
      <ScanController targetSourceId={targetSourceId} onScanComplete={handleScanComplete}>
        {({ state: scanState, lastScanAt, progress, starting, canStart, loading: scanLoading, startScan }) => {
          const initialLoading = scanLoading || state.status === 'loading';
          const busyLabel = initialLoading ? '불러오는 중...' : starting ? '시작 중...' : null;
          const phase = selectPhase({
            fetchStatus: state.status,
            scanState,
            hasCandidates: candidates.length > 0,
          });
          return (
            // No overflow-hidden: it would establish a clip box and kill the sticky CardActionBar.
            <section className={cardStyles.base}>
              <header className={cn('flex flex-wrap items-start justify-between gap-3', cardStyles.header)}>
                <div className="flex-shrink-0">
                  <h2 className={cn(cardStyles.cardTitle, 'whitespace-nowrap')}>연동 대상 DB 선택</h2>
                  <p className={cn('mt-2.5', cardStyles.subtitle)}>
                    Infra Scan을 통해 부위 DB 조회 후 Agent 연동 대상 DB를 선택하세요.
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {lastScanAt && (
                    <span className={cn('inline-flex items-center gap-1 text-[11.5px] whitespace-nowrap', textColors.tertiary)}>
                      <ClockIcon className="w-3 h-3" />
                      Last Scan: {formatDate(lastScanAt, 'datetime')}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    disabled={initialLoading || !canStart || readonly}
                    onClick={startScan}
                    className="inline-flex items-center gap-1.5 text-sm py-1.5"
                  >
                    {busyLabel ? (
                      <>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {busyLabel}
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-3.5 h-3.5" />
                        Run Infra Scan
                      </>
                    )}
                  </Button>
                </div>
              </header>

              <div className="px-6 py-6">{renderBody(phase, progress, startScan)}</div>
              {/* C-2 action zone (lifted out of CandidateResourceTable): the transition
                  CTA docks (sticky) at the card bottom while the long table scrolls. */}
              {phase === 'list' && !readonly && (
                <CardActionBar
                  hint={
                    <>
                      총 <strong className={textColors.primary}>{candidates.length}</strong>건 ·{' '}
                      <strong className={primaryColors.text}>{selectedIds.size}</strong>건 선택됨
                    </>
                  }
                >
                  <Button
                    variant="primary"
                    onClick={handleRequestApproval}
                    disabled={approval.loading || selectedIds.size === 0}
                    className="flex items-center gap-2"
                  >
                    {approval.loading && <LoadingSpinner />}
                    연동 대상 승인 요청
                  </Button>
                </CardActionBar>
              )}
            </section>
          );
        }}
      </ScanController>

      {!readonly && (
        <IdcSubmitModal
          isOpen={approvalModal.isOpen}
          total={candidates.length}
          live={selectedIds.size}
          excluded={Math.max(0, candidates.length - selectedIds.size)}
          submitting={approval.loading}
          onSubmit={handleApprovalConfirm}
          onClose={approvalModal.close}
        />
      )}

      {popover && (
        <IdcExclusionPopover
          anchor={popover.anchor}
          selectedPreset={exclusions[popover.resourceId]?.custom ? undefined : exclusions[popover.resourceId]?.reason}
          customActive={exclusions[popover.resourceId]?.custom ?? false}
          onPickPreset={picker.handlePickPreset}
          onPickCustom={picker.handlePickCustom}
          onDismiss={picker.dismissPopover}
        />
      )}

      {reasonModal.isOpen && reasonModal.data !== undefined && (
        <IdcExclusionReasonModal
          isOpen
          initialReason={exclusions[reasonModal.data]?.reason}
          maxLen={CLOUD_EXCL_REASON_MAXLEN}
          onSave={picker.handleSaveReason}
          onClose={reasonModal.close}
        />
      )}
    </>
  );
};
