'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import {
  getApprovalRequestDetail,
  type ApprovalRequestLatestResponse,
  type ApprovalResourceItem,
} from '@/app/lib/api';
import { formatDate } from '@/lib/utils/date';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';
import {
  StatTile,
  WaitingApprovalStats,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import { WaitingApprovalToolbar } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { useApprovalTableState } from '@/app/target-sources/[targetSourceId]/_components/layout/useApprovalTableState';
import { borderColors, cn, getButtonClass, statusColors, textColors } from '@/lib/theme';

interface ApprovalHistoryItem {
  request: {
    id: string | number;
    requested_by: string;
    requested_at: string;
    resource_total_count?: number;
    resource_selected_count?: number;
  };
  result?: {
    result?: string;
    processed_at?: string;
    process_info: { user_id?: string; reason?: string };
  };
}

interface ApprovalRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ApprovalHistoryItem | null;
  latestResponse?: ApprovalRequestLatestResponse | null;
  /**
   * When set (with a numeric history item id), the modal fetches
   * GET …/approval-requests/{requestId} on open and renders the actual
   * 대상/비대상 resource lists instead of counts alone.
   */
  targetSourceId?: number;
}

type ResultStatus = string | undefined;

/** Header badge only — the verdict is stated once, not restated as a filled panel. */
const getResultMeta = (status: ResultStatus) => {
  switch (status) {
    case 'APPROVED':
      return { badgeVariant: 'success' as const, badgeLabel: '승인 완료' };
    case 'AUTO_APPROVED':
      return { badgeVariant: 'success' as const, badgeLabel: '자동 승인' };
    case 'REJECTED':
      return { badgeVariant: 'error' as const, badgeLabel: '반려됨' };
    case 'CANCELLED':
      return { badgeVariant: 'pending' as const, badgeLabel: '요청 취소' };
    case 'SYSTEM_ERROR':
      return { badgeVariant: 'error' as const, badgeLabel: '처리 오류' };
    case 'COMPLETED':
      return { badgeVariant: 'success' as const, badgeLabel: '적용 완료' };
    default:
      return { badgeVariant: 'info' as const, badgeLabel: '승인 대기' };
  }
};

interface NormalizedData {
  requestId: string;
  requestedBy: string;
  requestedAt: string;
  resultStatus: ResultStatus;
  processedAt: string | undefined;
  processedBy: string | null;
  reason: string | null;
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
}

// Output adapter: contract ApprovalRequestLatestDto → view-model (counts from contract fields).
const toSummaryViewFromLatest = (response: ApprovalRequestLatestResponse): NormalizedData => {
  const totalCount = response.request?.resource_total_count ?? 0;
  const selectedCount = response.request?.resource_selected_count ?? 0;
  return {
    requestId: String(response.request?.id ?? ''),
    requestedBy: response.request?.requested_by?.user_id ?? 'Unknown',
    requestedAt: response.request?.requested_at ?? '',
    resultStatus: response.result?.status ?? undefined,
    processedAt: response.result?.processed_at ?? undefined,
    processedBy: response.result?.processed_by?.user_id ?? null,
    reason: response.result?.reason ?? null,
    totalCount,
    selectedCount,
    excludedCount: Math.max(totalCount - selectedCount, 0),
  };
};

// Output adapter: contract ApprovalRequestSummaryDto (history item) → view-model.
const toSummaryViewFromHistory = (item: ApprovalHistoryItem): NormalizedData => {
  const totalCount = item.request.resource_total_count ?? 0;
  const selectedCount = item.request.resource_selected_count ?? 0;
  return {
    requestId: String(item.request.id),
    requestedBy: item.request.requested_by,
    requestedAt: item.request.requested_at,
    resultStatus: item.result?.result,
    processedAt: item.result?.processed_at,
    processedBy: item.result?.process_info.user_id ?? null,
    reason: item.result?.process_info.reason ?? null,
    totalCount,
    selectedCount,
    excludedCount: Math.max(totalCount - selectedCount, 0),
  };
};

/** integration_category → operator-facing label for a 비대상 row without an explicit reason. */
const CATEGORY_LABEL: Record<string, string> = {
  NO_INSTALL_NEEDED: '설치 선택',
  INSTALL_INELIGIBLE: '설치 불가',
};

/**
 * Wire → the row shape the step-2 table reads. Same mapping as
 * WaitingApprovalCard.toResourceRow, plus the category fallback this modal has
 * always applied to a 비대상 row that carries no explicit reason.
 */
const toResourceRow = (item: ApprovalResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.resource_type ?? item.metadata?.database_type ?? '',
  region: item.metadata?.region ?? '',
  resourceName: item.resource_name ?? '',
  selected: item.selected ?? false,
  displayDbType: item.metadata?.database_type ?? item.resource_type ?? undefined,
  exclusionReason:
    item.exclusion_reason || CATEGORY_LABEL[item.integration_category ?? ''] || undefined,
});

const FILTER_EMPTY_MESSAGE = '조건에 맞는 결과가 없어요.';

export const ApprovalRequestDetailModal = ({
  isOpen,
  onClose,
  item,
  latestResponse,
  targetSourceId,
}: ApprovalRequestDetailModalProps) => {
  // Resource lists: latest responses carry them inline; history items need the
  // per-request detail fetch (GET …/approval-requests/{requestId}).
  // `rows: null` marks a failed fetch for that id; loading is derived, never set.
  const [fetchResult, setFetchResult] = useState<{
    id: number;
    rows: ApprovalResourceItem[] | null;
  } | null>(null);

  const historyRequestId =
    item && typeof item.request.id === 'number' ? item.request.id : null;
  const needsFetch =
    isOpen && !latestResponse && targetSourceId != null && historyRequestId != null;
  const fetchLoading = needsFetch && fetchResult?.id !== historyRequestId;

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getApprovalRequestDetail(targetSourceId, historyRequestId);
        if (!cancelled) setFetchResult({ id: historyRequestId, rows: detail.resources ?? [] });
      } catch {
        if (!cancelled) setFetchResult({ id: historyRequestId, rows: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsFetch, targetSourceId, historyRequestId]);

  const resources = latestResponse
    ? latestResponse.resources ?? null
    : fetchResult?.id === historyRequestId
      ? fetchResult.rows
      : null;

  // Declared before the early return — the list state is a hook and cannot be conditional.
  const rows = useMemo<readonly WaitingApprovalResource[]>(
    () => (resources ?? []).map(toResourceRow),
    [resources],
  );
  const table = useApprovalTableState(rows);

  if (!item && !latestResponse) return null;

  const data = latestResponse
    ? toSummaryViewFromLatest(latestResponse)
    : toSummaryViewFromHistory(item!);
  const resultMeta = getResultMeta(data.resultStatus);
  const showFilterEmpty = rows.length > 0 && table.filteredCount === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 상세"
      subtitle={`요청 ID ${data.requestId}`}
      size="3xl"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      footer={
        <button onClick={onClose} className={getButtonClass('secondary')}>
          닫기
        </button>
      }
    >
      {/* ① 상태 + 요청/처리 사실. Reference tier: the verdict is one badge and the rest
          are labelled pairs — no panel, no cards, so the list below owns the weight. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Badge variant={resultMeta.badgeVariant} dot>
          {resultMeta.badgeLabel}
        </Badge>
        <MetaField label="요청자" value={data.requestedBy} />
        <MetaField label="요청일시" value={formatDate(data.requestedAt, 'datetime')} />
        {data.processedBy && <MetaField label="처리자" value={data.processedBy} />}
        {data.processedAt && (
          <MetaField label="처리일시" value={formatDate(data.processedAt, 'datetime')} />
        )}
      </div>

      {/* ② 처리 사유 — quoted off a rule (RejectionVerdict grammar), and only when the
          admin actually left words: no reason → no block, rather than "메모 없음". */}
      {data.reason && (
        <div className={cn('mt-5 border-l-[3px] pl-4', statusColors.warning.borderStrong)}>
          <p className={cn('text-[12px] font-bold tracking-[0.02em]', statusColors.warning.textDark)}>
            처리 사유
          </p>
          <p className={cn('mt-1.5 text-[17px] font-semibold leading-[1.5]', textColors.primary)}>
            {data.reason}
          </p>
        </div>
      )}

      {/* ③ 요청 리소스 — the payload, and the reason this modal exists. Same stack as
          step 2: filter tiles → toolbar → table → pagination. */}
      <div className="mt-6">
        {fetchLoading ? (
          <p className={cn('rounded-lg border p-6 text-center text-sm', borderColors.default, textColors.tertiary)}>
            리소스 목록을 불러오는 중…
          </p>
        ) : resources != null ? (
          <>
            <WaitingApprovalStats
              totalCount={table.countsByFilter.all}
              selectedCount={table.countsByFilter.target}
              excludedCount={table.countsByFilter.excluded}
              filter={table.filter}
              onFilterChange={table.onFilterChange}
            />
            <WaitingApprovalToolbar
              searchValue={table.searchValue}
              onSearchChange={table.onSearchChange}
              dbType={table.dbType}
              onDbTypeChange={table.onDbTypeChange}
              region={table.region}
              onRegionChange={table.onRegionChange}
              dbTypeOptions={table.dbTypeOptions}
              regionOptions={table.regionOptions}
            />
            <WaitingApprovalTable
              resources={table.visibleResources}
              connected
              emptyMessage={showFilterEmpty ? FILTER_EMPTY_MESSAGE : undefined}
            />
            {table.filteredCount > 0 && (
              <Pagination
                page={table.safePage}
                pageSize={table.pageSize}
                totalCount={table.filteredCount}
                onPageChange={table.onPageChange}
                onPageSizeChange={table.onPageSizeChange}
              />
            )}
          </>
        ) : (
          /* Detail unavailable (fetch failed, or a history row with no numeric id to fetch
             by) — the summary counts still answer "얼마나", in the tiles the list would
             have used. */
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="전체 요청" value={data.totalCount} unit="건" />
            <StatTile label="연동 요청 대상" value={data.selectedCount} unit="건" />
            <StatTile label="연동 요청 제외대상" value={data.excludedCount} unit="건" />
          </div>
        )}
      </div>
    </Modal>
  );
};
