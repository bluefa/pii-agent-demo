import { Badge } from '@/app/components/ui/Badge';
import { Modal } from '@/app/components/ui/Modal';
import type { ApprovalHistoryResponse, ApprovalRequestLatestResponse } from '@/app/lib/api';
import { cn, statusColors, getButtonClass, textColors, bgColors, borderColors } from '@/lib/theme';

type ApprovalHistoryItem = ApprovalHistoryResponse['content'][number];

interface ApprovalRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ApprovalHistoryItem | null;
  latestResponse?: ApprovalRequestLatestResponse | null;
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
        description: '승인 요청이 반려되었습니다. 처리 사유가 함께 기록되어 있으면 아래 요약에 표시됩니다.',
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
        description: '관리자 검토를 기다리는 요청입니다. 계약 기준으로 이 화면은 요청 메타데이터와 처리 결과 중심으로 표시합니다.',
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

const normalizeFromLatestResponse = (response: ApprovalRequestLatestResponse): NormalizedData => {
  const totalCount = response.request.resource_total_count;
  const selectedCount = response.request.resource_selected_count;
  return {
    requestId: String(response.request.id),
    requestedBy: response.request.requested_by.user_id,
    requestedAt: response.request.requested_at,
    resultStatus: response.result.status,
    processedAt: response.result.processed_at,
    processedBy: response.result.processed_by?.user_id ?? null,
    reason: response.result.reason,
    totalCount,
    selectedCount,
    excludedCount: Math.max(totalCount - selectedCount, 0),
  };
};

const normalizeFromHistoryItem = (item: ApprovalHistoryItem): NormalizedData => {
  const resourceInputs = item.request.input_data?.resource_inputs ?? [];
  const selectedCountFromSnapshot = resourceInputs.filter((r) => r.selected).length;
  const totalCount = item.request.resource_total_count ?? resourceInputs.length;
  const selectedCount = item.request.resource_selected_count ?? selectedCountFromSnapshot;
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

export const ApprovalRequestDetailModal = ({
  isOpen,
  onClose,
  item,
  latestResponse,
}: ApprovalRequestDetailModalProps) => {
  if (!item && !latestResponse) return null;

  const data = latestResponse
    ? normalizeFromLatestResponse(latestResponse)
    : normalizeFromHistoryItem(item!);

  const hasRequestSummary = data.totalCount > 0 || data.selectedCount > 0;
  const resultMeta = getResultMeta(data.resultStatus);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 요약"
      subtitle={resultMeta.badgeLabel}
      size="xl"
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
        <div className={cn('rounded-xl border p-4 space-y-3', resultMeta.panelBg, resultMeta.panelBorder)}>
          <div className="flex items-center justify-between gap-3">
            <Badge variant={resultMeta.badgeVariant} dot>
              {resultMeta.badgeLabel}
            </Badge>
            <span className={cn('text-xs', textColors.tertiary)}>요청 ID {data.requestId}</span>
          </div>
          <p className={cn('text-sm leading-6', resultMeta.panelText)}>{resultMeta.description}</p>
        </div>

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

        {hasRequestSummary ? (
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
        ) : (
          <div className={cn('rounded-xl border p-4 space-y-2', statusColors.info.bg, statusColors.info.border)}>
            <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
              요청 메타데이터 중심 요약입니다
            </p>
            <p className={cn('text-sm leading-6', statusColors.info.text)}>
              계약 기준으로 `approval-history`와 `approval-requests/latest`는 요약 정보만 보장합니다.
              상세 선택 복원은 `target-source`, `approved-integration`, `confirmed-integration` 응답을 기준으로 이어집니다.
            </p>
          </div>
        )}

        {data.resultStatus && data.resultStatus !== 'PENDING' && (
          <div className={cn('rounded-xl border p-4 space-y-3', borderColors.default, bgColors.muted)}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn('text-sm font-semibold', textColors.primary)}>처리 결과 요약</p>
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
