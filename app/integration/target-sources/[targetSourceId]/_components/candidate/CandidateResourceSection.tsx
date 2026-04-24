'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  createApprovalRequest,
  getConfirmResources,
  type ApprovalResourceInput,
} from '@/app/lib/api';
import { catalogToCandidates } from '@/lib/resource-catalog';
import { AppError } from '@/lib/errors';
import { formatDate } from '@/lib/utils/date';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useToast } from '@/app/components/ui/toast';
import { ScanController } from '@/app/components/features/scan/ScanPanel';
import { ScanEmptyState } from '@/app/components/features/scan/ScanEmptyState';
import { ScanErrorState } from '@/app/components/features/scan/ScanErrorState';
import { ScanRunningState } from '@/app/components/features/scan/ScanRunningState';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
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
import type { Resource } from '@/lib/types';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { getCandidateBehavior } from './candidate-resource-behavior';
import { getCandidateErrorMessage } from './errors';
import { CandidateResourceTable } from './CandidateResourceTable';

const ApprovalRequestModal = dynamic(
  () =>
    import('@/app/components/features/process-status/ApprovalRequestModal').then(
      (module) => ({ default: module.ApprovalRequestModal }),
    ),
  { ssr: false },
);

const clockIcon = (
  <svg
    className="w-3 h-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const playIcon = (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

interface CandidateResourceSectionProps {
  targetSourceId: number;
  readonly: boolean;
  refreshProject: () => Promise<void>;
}

const EMPTY_DRAFTS: CandidateDraftState = { endpointDrafts: {} };
const EMPTY_CANDIDATES: CandidateResource[] = [];

const toModalResources = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
): Resource[] =>
  candidates.map((candidate) => {
    const endpoint = drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig;
    return {
      id: candidate.id,
      resourceId: candidate.resourceId,
      type: candidate.type,
      connectionStatus: 'PENDING',
      isSelected: selectedIds.has(candidate.id),
      databaseType: candidate.databaseType,
      integrationCategory: candidate.integrationCategory,
      ...(endpoint ? { vmDatabaseConfig: endpoint } : {}),
    };
  });

export const CandidateResourceSection = ({
  targetSourceId,
  readonly,
  refreshProject,
}: CandidateResourceSectionProps) => {
  const toast = useToast();
  const [state, setState] = useState<AsyncState<CandidateResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [drafts, setDrafts] = useState<CandidateDraftState>(EMPTY_DRAFTS);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void getConfirmResources(targetSourceId, { signal: controller.signal })
      .then((response) => {
        setState({ status: 'ready', data: catalogToCandidates(response.resources) });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
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

  const approval = useApiMutation(
    async (payload: { formData: ApprovalRequestFormData }) => {
      const resourceInputs = buildResourceInputs(candidates, selectedIds, drafts, payload.formData);
      await createApprovalRequest(targetSourceId, {
        resource_inputs: resourceInputs,
        ...(payload.formData.exclusion_reason_default
          ? { exclusion_reason_default: payload.formData.exclusion_reason_default }
          : {}),
      });
      await refreshProject();
    },
    {
      onSuccess: () => {
        setApprovalModalOpen(false);
        setExpandedResourceId(null);
      },
      suppressAlert: true,
      errorMessage: '승인 요청에 실패했습니다.',
    },
  );

  const approvalError = approval.error
    ? approval.error.message || '승인 요청에 실패했습니다.'
    : null;

  const handleToggleSelected = useCallback((resourceId: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(resourceId);
      else next.delete(resourceId);
      return next;
    });
  }, []);

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
    setApprovalModalOpen(true);
  }, [approval, candidates, drafts, selectedIds, toast]);

  const handleScanComplete = useCallback(async () => {
    setSelectedIds(new Set());
    setDrafts(EMPTY_DRAFTS);
    setExpandedResourceId(null);
    refetch();
    await refreshProject();
  }, [refetch, refreshProject]);

  const handleApprovalSubmit = useCallback((formData: ApprovalRequestFormData) => {
    void approval.mutate({ formData });
  }, [approval]);

  const modalResources = useMemo(
    () => toModalResources(candidates, selectedIds, drafts),
    [candidates, drafts, selectedIds],
  );

  return (
    <>
      <ScanController targetSourceId={targetSourceId} onScanComplete={handleScanComplete}>
        {({ state: scanState, lastScanAt, progress, starting, canStart, startScan }) => (
          <section className={cn(cardStyles.base, 'overflow-hidden')}>
            <header className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex-shrink-0">
                <h2 className="text-[15px] font-semibold text-gray-900 whitespace-nowrap">연동 대상 DB 선택</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Infra Scan을 통해 부위 DB 조회 후 Agent 연동 대상 DB를 선택하세요.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {lastScanAt && (
                  <span className={cn('inline-flex items-center gap-1 text-[11.5px] whitespace-nowrap', textColors.tertiary)}>
                    {clockIcon}
                    Last Scan: {formatDate(lastScanAt, 'datetime')}
                  </span>
                )}
                <Button
                  variant="primary"
                  disabled={!canStart || readonly}
                  onClick={startScan}
                  className="inline-flex items-center gap-1.5 text-sm py-1.5"
                >
                  {starting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      시작 중...
                    </>
                  ) : (
                    <>
                      {playIcon}
                      Run Infra Scan
                    </>
                  )}
                </Button>
              </div>
            </header>

            <div className="px-6 py-6">
              {state.status === 'loading' ? (
                <div className="flex items-center justify-center gap-3 py-10">
                  <LoadingSpinner />
                  <span className={cn('text-sm', textColors.tertiary)}>리소스 정보를 불러오는 중입니다.</span>
                </div>
              ) : state.status === 'error' ? (
                <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
                  <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{state.message}</p>
                  <button onClick={refetch} className={getButtonClass('secondary')}>
                    다시 시도
                  </button>
                </div>
              ) : candidates.length > 0 ? (
                <CandidateResourceTable
                  candidates={candidates}
                  selectedIds={selectedIds}
                  drafts={drafts}
                  expandedResourceId={expandedResourceId}
                  readonly={readonly}
                  approvalSubmitting={approval.loading}
                  onToggleSelected={handleToggleSelected}
                  onExpandToggle={handleExpandToggle}
                  onEndpointSave={handleEndpointSave}
                  onRequestApproval={handleRequestApproval}
                />
              ) : scanState === 'IN_PROGRESS' ? (
                <ScanRunningState progress={progress} />
              ) : scanState === 'FAILED' ? (
                <ScanErrorState onRetry={startScan} />
              ) : (
                <ScanEmptyState />
              )}
            </div>
          </section>
        )}
      </ScanController>

      {!readonly && (
        <ApprovalRequestModal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          onSubmit={handleApprovalSubmit}
          resources={modalResources}
          loading={approval.loading}
          error={approvalError}
        />
      )}
    </>
  );
};

const buildResourceInputs = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  formData: ApprovalRequestFormData,
): ApprovalResourceInput[] =>
  candidates.map((candidate) => {
    if (selectedIds.has(candidate.id)) {
      const behavior = getCandidateBehavior(candidate);
      const resourceInput = behavior.buildApprovalInput(candidate, drafts);
      return {
        resource_id: candidate.id,
        selected: true,
        ...(resourceInput ? { resource_input: resourceInput } : {}),
      };
    }
    return {
      resource_id: candidate.id,
      selected: false,
      ...(formData.exclusion_reason_default
        ? { exclusion_reason: formData.exclusion_reason_default }
        : {}),
    };
  });
