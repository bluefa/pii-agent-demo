'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { Modal } from '@/app/components/ui/Modal';
import {
  getApprovalRequestDetail,
  type ApprovalRequestLatestResponse,
  type ApprovalResourceItem,
} from '@/app/lib/api';
import { cn, statusColors, getButtonClass, textColors, bgColors, borderColors } from '@/lib/theme';

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

const formatDateTime = (iso?: string): string => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ResultStatus = string | undefined;

const getResultMeta = (status: ResultStatus) => {
  switch (status) {
    case 'APPROVED':
      return {
        badgeVariant: 'success' as const,
        badgeLabel: '승인 완료',
        panelBg: statusColors.success.bg,
        panelBorder: statusColors.success.border,
        panelText: statusColors.success.textDark,
        description: '승인 처리가 기록되었습니다. 실제 적용 대상은 반영 단계 또는 현재 연동 정보에서 이어서 확인할 수 있습니다.',
      };
    case 'AUTO_APPROVED':
      return {
        badgeVariant: 'success' as const,
        badgeLabel: '자동 승인',
        panelBg: statusColors.success.bg,
        panelBorder: statusColors.success.border,
        panelText: statusColors.success.textDark,
        description: '관리자 개입 없이 자동 승인된 요청입니다. 이후 반영 단계에서 실제 적용 상태를 확인할 수 있습니다.',
      };
    case 'REJECTED':
      return {
        badgeVariant: 'error' as const,
        badgeLabel: '반려됨',
        panelBg: statusColors.error.bg,
        panelBorder: statusColors.error.border,
        panelText: statusColors.error.textDark,
        description: '승인 요청이 반려되었습니다. 처리 사유가 함께 기록되어 있으면 처리 결과에 표시됩니다.',
      };
    case 'CANCELLED':
      return {
        badgeVariant: 'pending' as const,
        badgeLabel: '요청 취소',
        panelBg: statusColors.pending.bg,
        panelBorder: statusColors.pending.border,
        panelText: textColors.secondary,
        description: '요청자가 승인 대기 중 요청을 취소했습니다. 필요하면 현재 리소스 선택 상태로 다시 요청할 수 있습니다.',
      };
    case 'SYSTEM_ERROR':
      return {
        badgeVariant: 'error' as const,
        badgeLabel: '처리 오류',
        panelBg: statusColors.error.bg,
        panelBorder: statusColors.error.border,
        panelText: statusColors.error.textDark,
        description: '승인 처리 중 시스템 오류가 기록되었습니다. 적용 여부는 별도 스냅샷 API로 다시 확인하는 편이 안전합니다.',
      };
    case 'COMPLETED':
      return {
        badgeVariant: 'success' as const,
        badgeLabel: '적용 완료',
        panelBg: statusColors.success.bg,
        panelBorder: statusColors.success.border,
        panelText: statusColors.success.textDark,
        description: '승인 이후 실제 적용까지 완료된 이력입니다. 현재 연동 정보와 최종 결과를 함께 확인하면 됩니다.',
      };
    default:
      return {
        badgeVariant: 'info' as const,
        badgeLabel: '승인 대기',
        panelBg: statusColors.info.bg,
        panelBorder: statusColors.info.border,
        panelText: statusColors.info.textDark,
        description: '관리자 검토를 기다리는 요청입니다.',
      };
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
  NO_INSTALL_NEEDED: '설치 불필요',
  INSTALL_INELIGIBLE: '설치 불가',
};

/** Region / host:port — whichever the resource metadata carries. */
const locationOf = (r: ApprovalResourceItem): string => {
  const meta = r.metadata;
  const host = meta?.host ?? null;
  if (host) return meta?.port != null ? `${host}:${meta.port}` : host;
  return meta?.region ?? '-';
};

/** database_type rides under metadata (passthrough key — not in the declared DTO). */
const databaseTypeOf = (r: ApprovalResourceItem): string | null => {
  const value = (r.metadata as Record<string, unknown> | null | undefined)?.database_type;
  return typeof value === 'string' ? value : null;
};

const RESOURCE_TH = cn('px-3 py-2 text-left text-xs font-medium whitespace-nowrap', textColors.tertiary);
const RESOURCE_TD = cn('px-3 py-2.5 text-sm border-t', borderColors.default, textColors.secondary);

function ResourceTable({
  rows,
  emptyLabel,
  reasonColumn,
}: {
  rows: ApprovalResourceItem[];
  emptyLabel: string;
  reasonColumn: boolean;
}) {
  if (rows.length === 0) {
    return <p className={cn('px-1 py-3 text-sm', textColors.tertiary)}>{emptyLabel}</p>;
  }
  return (
    <div className={cn('overflow-x-auto rounded-lg border', borderColors.default)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={bgColors.muted}>
            <th className={RESOURCE_TH}>리소스</th>
            <th className={RESOURCE_TH}>Database</th>
            <th className={RESOURCE_TH}>{reasonColumn ? '제외 사유' : '위치'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, index) => (
            <tr key={`${r.resource_id ?? 'row'}-${index}`}>
              <td className={RESOURCE_TD}>
                <p className={cn('text-sm font-medium', textColors.primary)}>
                  {r.resource_name || r.resource_id || '-'}
                </p>
                {r.resource_name && r.resource_id && (
                  <p className={cn('mt-0.5 break-all font-mono text-xs', textColors.tertiary)}>
                    {r.resource_id}
                  </p>
                )}
              </td>
              <td className={cn(RESOURCE_TD, 'whitespace-nowrap')}>{databaseTypeOf(r) ?? '-'}</td>
              <td className={RESOURCE_TD}>
                {reasonColumn
                  ? r.exclusion_reason || CATEGORY_LABEL[r.integration_category ?? ''] || '-'
                  : locationOf(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  if (!item && !latestResponse) return null;

  const data = latestResponse
    ? toSummaryViewFromLatest(latestResponse)
    : toSummaryViewFromHistory(item!);

  const resources = latestResponse
    ? latestResponse.resources ?? null
    : fetchResult?.id === historyRequestId
      ? fetchResult.rows
      : null;
  const selectedResources = (resources ?? []).filter((r) => r.selected === true);
  const excludedResources = (resources ?? []).filter((r) => r.selected !== true);
  const resultMeta = getResultMeta(data.resultStatus);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 상세"
      subtitle={resultMeta.badgeLabel}
      size="2xl"
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
      <div className="space-y-5">
        {/* ① 처리 상태 — one glanceable panel answering "이 요청은 지금 어떤 상태인가". */}
        <div className={cn('rounded-xl border p-4 space-y-3', resultMeta.panelBg, resultMeta.panelBorder)}>
          <div className="flex items-center justify-between gap-3">
            <Badge variant={resultMeta.badgeVariant} dot>
              {resultMeta.badgeLabel}
            </Badge>
            <span className={cn('text-xs', textColors.tertiary)}>요청 ID {data.requestId}</span>
          </div>
          <p className={cn('text-sm leading-6', resultMeta.panelText)}>{resultMeta.description}</p>
        </div>

        {/* ② 요청 정보 */}
        <div className="grid grid-cols-3 gap-3">
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청자</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{data.requestedBy}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청 시각</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{formatDateTime(data.requestedAt)}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>처리 시각</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{formatDateTime(data.processedAt)}</p>
          </div>
        </div>

        {/* ③ 연동 대상 / 비대상 리소스 — the actual request payload, split. */}
        {fetchLoading ? (
          <div className={cn('rounded-lg border p-6 text-center text-sm', borderColors.default, textColors.tertiary)}>
            리소스 목록을 불러오는 중…
          </div>
        ) : resources != null ? (
          <>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className={cn('text-sm font-semibold', textColors.primary)}>연동 대상 리소스</p>
                <span className={cn('text-xs', textColors.tertiary)}>{selectedResources.length}개</span>
              </div>
              <ResourceTable rows={selectedResources} emptyLabel="연동 대상 리소스가 없습니다." reasonColumn={false} />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className={cn('text-sm font-semibold', textColors.primary)}>연동 비대상 리소스</p>
                <span className={cn('text-xs', textColors.tertiary)}>{excludedResources.length}개</span>
              </div>
              <ResourceTable rows={excludedResources} emptyLabel="제외된 리소스가 없습니다." reasonColumn />
            </div>
          </>
        ) : (
          /* Detail unavailable (fetch failed or no id to fetch by) — fall back to the counts. */
          <div className="grid grid-cols-2 gap-3">
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>승인 대상 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{data.selectedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>summary 응답 기준</p>
            </div>
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>제외 대상 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{data.excludedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>총 요청 리소스 {data.totalCount}개</p>
            </div>
          </div>
        )}

        {/* ④ 처리 결과 */}
        {data.resultStatus && data.resultStatus !== 'PENDING' && (
          <div className={cn('rounded-xl border p-4 space-y-3', borderColors.default, bgColors.muted)}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn('text-sm font-semibold', textColors.primary)}>처리 결과</p>
              <Badge variant={resultMeta.badgeVariant}>{data.resultStatus}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className={cn('text-xs font-medium', textColors.tertiary)}>처리자</p>
                <p className={cn('text-sm', textColors.secondary)}>{data.processedBy ?? '시스템'}</p>
              </div>
              <div className="space-y-1">
                <p className={cn('text-xs font-medium', textColors.tertiary)}>처리 시각</p>
                <p className={cn('text-sm', textColors.secondary)}>{formatDateTime(data.processedAt)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className={cn('text-xs font-medium', textColors.tertiary)}>메모</p>
              <p className={cn('text-sm leading-6', textColors.secondary)}>
                {data.reason ?? '추가 메모가 없습니다.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
