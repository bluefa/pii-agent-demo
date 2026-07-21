'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createApprovalRequest,
  getConfirmResources,
} from '@/app/lib/api';
import { catalogToCandidates } from '@/lib/resource-catalog';
import { AppError } from '@/lib/errors';
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
  cardStyles,
  cn,
  getButtonClass,
  statusColors,
  textColors,
} from '@/lib/theme';
import type {
  CandidateDraftState,
  CandidateResource,
  EndpointConfigDraft,
} from '@/lib/types/resources';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { getCandidateErrorMessage } from '@/app/target-sources/[targetSourceId]/_components/candidate/errors';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';
import { selectPhase } from '@/app/target-sources/[targetSourceId]/_components/candidate/phase';
import { toApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import { fetchResourcesWithRetry } from '@/app/target-sources/[targetSourceId]/_components/candidate/load-resources';
import { IdcSubmitModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';
import { IdcExclusionPopover } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcExclusionPopover';
import { IdcExclusionReasonModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcExclusionReasonModal';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';

/** Per-resource exclusion reason held while the user picks it (mirror of the IDC flow). */
interface Exclusion {
  reason: string;
  /** True when entered via the free-text modal (vs a preset) — drives the popover highlight. */
  custom: boolean;
}
interface PopoverState {
  resourceId: string;
  anchor: HTMLElement;
}

interface CandidateResourceSectionProps {
  targetSourceId: number;
  readonly: boolean;
  refreshProject: () => Promise<void>;
}

const EMPTY_DRAFTS: CandidateDraftState = { endpointDrafts: {} };
const EMPTY_CANDIDATES: CandidateResource[] = [];

// Right after a scan the resource list can momentarily read empty or error while the
// backend finishes materializing it — retry a few times before settling into the
// empty/error state. A plain load does a single attempt (empty is a valid rest state).
const MAX_RESOURCE_ATTEMPTS = 4; // 1 initial + 3 retries
const RESOURCE_RETRY_DELAY_MS = 800;

export const CandidateResourceSection = ({
  targetSourceId,
  readonly,
  refreshProject,
}: CandidateResourceSectionProps) => {
  const toast = useToast();
  const approvalModal = useModal();
  const [state, setState] = useState<AsyncState<CandidateResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exclusions, setExclusions] = useState<Record<string, Exclusion>>({});
  const [drafts, setDrafts] = useState<CandidateDraftState>(EMPTY_DRAFTS);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  // Set by handleScanComplete so the next fetch retries on empty/error (post-scan race).
  const retryAfterScanRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const maxAttempts = retryAfterScanRef.current ? MAX_RESOURCE_ATTEMPTS : 1;
    retryAfterScanRef.current = false;

    const delayBeforeRetry = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, RESOURCE_RETRY_DELAY_MS);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

    void fetchResourcesWithRetry(
      () =>
        getConfirmResources(targetSourceId, { signal: controller.signal }).then((response) =>
          catalogToCandidates(response.resources),
        ),
      maxAttempts,
      delayBeforeRetry,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', data });
        // Seed selection from the backend's `selected` flag (never for ineligible
        // rows, whose checkbox is disabled), and seed any exclusion reasons it sent.
        setSelectedIds(new Set(
          data.filter((c) => c.selected && c.integrationCategory !== 'INSTALL_INELIGIBLE').map((c) => c.id),
        ));
        setExclusions(Object.fromEntries(
          data
            .filter((c) => !c.selected && c.exclusionReason)
            .map((c) => [c.id, { reason: c.exclusionReason as string, custom: !IDC_EXCL_PRESETS.includes(c.exclusionReason as (typeof IDC_EXCL_PRESETS)[number]) }]),
        ));
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: getCandidateErrorMessage(error) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const candidates = useMemo(
    () => (state.status === 'ready' ? state.data : EMPTY_CANDIDATES),
    [state],
  );

  const refetch = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  // Plain id→reason map for the payload adapter and the table's reason chips.
  const exclusionReasons = useMemo(
    () => Object.fromEntries(Object.entries(exclusions).map(([id, e]) => [id, e.reason])),
    [exclusions],
  );

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

  const select = useCallback((resourceId: string) => {
    setSelectedIds((previous) => new Set(previous).add(resourceId));
    setExclusions(({ [resourceId]: _removed, ...rest }) => rest);
  }, []);

  const exclude = useCallback((resourceId: string, reason: string, custom: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(resourceId);
      return next;
    });
    setExclusions((previous) => ({ ...previous, [resourceId]: { reason, custom } }));
  }, []);

  // Unchecking a target opens the exclusion-reason picker; the row stays selected
  // until a reason is confirmed (mirror of the IDC flow). Re-checking clears it.
  const handleToggleSelected = useCallback(
    (resourceId: string, checked: boolean, anchor: HTMLElement) => {
      if (checked) select(resourceId);
      else setPopover({ resourceId, anchor });
    },
    [select],
  );

  const handleReasonChipClick = useCallback((resourceId: string, anchor: HTMLElement) => {
    setPopover({ resourceId, anchor });
  }, []);

  const handlePickPreset = useCallback((reason: string) => {
    if (!popover) return;
    exclude(popover.resourceId, reason, false);
    setPopover(null);
  }, [popover, exclude]);

  const handlePickCustom = useCallback(() => {
    if (!popover) return;
    setReasonFor(popover.resourceId);
    setPopover(null);
  }, [popover]);

  const handleSaveReason = useCallback((reason: string) => {
    if (!reasonFor) return;
    exclude(reasonFor, reason, true);
    setReasonFor(null);
  }, [reasonFor, exclude]);

  const handleExpandToggle = useCallback((resourceId: string | null) => {
    setExpandedResourceId(resourceId);
  }, []);

  const handleEndpointSave = useCallback((resourceId: string, draft: EndpointConfigDraft) => {
    setDrafts((previous) => ({
      ...previous,
      endpointDrafts: { ...previous.endpointDrafts, [resourceId]: draft },
    }));
  }, []);

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
    approval.reset();
    approvalModal.open();
  }, [approval, approvalModal, candidates, drafts, selectedIds, toast]);

  const handleScanComplete = useCallback(async () => {
    // Fresh scan → clear working state; the refetch re-seeds selection/exclusions
    // from the new results' `selected`/`exclusion_reason` flags.
    setSelectedIds(new Set());
    setExclusions({});
    setDrafts(EMPTY_DRAFTS);
    setExpandedResourceId(null);
    setPopover(null);
    setReasonFor(null);
    retryAfterScanRef.current = true; // retry on empty/error for this post-scan fetch
    refetch();
    await refreshProject();
  }, [refetch, refreshProject]);

  const handleApprovalConfirm = useCallback(() => {
    void approval.execute();
  }, [approval]);

  const renderBody = (scanState: ScanUiState, progress: number, startScan: () => void) => {
    const phase = selectPhase({
      fetchStatus: state.status,
      scanState,
      hasCandidates: candidates.length > 0,
    });
    const errorMessage = state.status === 'error' ? state.message : '';

    switch (phase) {
      case 'fetching':
        return (
          <div className="flex items-center justify-center gap-3 py-10">
            <LoadingSpinner />
            <span className={cn('text-sm', textColors.tertiary)}>리소스 정보를 불러오는 중입니다.</span>
          </div>
        );
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
            approvalSubmitting={approval.loading}
            onToggleSelected={handleToggleSelected}
            onReasonChipClick={handleReasonChipClick}
            onExpandToggle={handleExpandToggle}
            onEndpointSave={handleEndpointSave}
            onRequestApproval={handleRequestApproval}
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
          return (
            <section className={cn(cardStyles.base, 'overflow-hidden')}>
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
                    {initialLoading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        불러오는 중...
                      </>
                    ) : starting ? (
                      <>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        시작 중...
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

              <div className="px-6 py-6">{renderBody(scanState, progress, startScan)}</div>
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
          onPickPreset={handlePickPreset}
          onPickCustom={handlePickCustom}
          onDismiss={() => setPopover(null)}
        />
      )}

      {reasonFor !== null && (
        <IdcExclusionReasonModal
          isOpen
          initialReason={exclusions[reasonFor]?.reason}
          onSave={handleSaveReason}
          onClose={() => setReasonFor(null)}
        />
      )}
    </>
  );
};
