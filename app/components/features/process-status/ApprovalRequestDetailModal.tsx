import { Badge } from '@/app/components/ui/Badge';
import { Modal } from '@/app/components/ui/Modal';
import type { ApprovalHistoryResponse } from '@/app/lib/api';
import { cn, statusColors, getButtonClass, textColors, bgColors, borderColors } from '@/lib/theme';

type ApprovalHistoryItem = ApprovalHistoryResponse['content'][number];
type ApprovalRequest = ApprovalHistoryItem['request'];
type ApprovalRequestWithOptionalInputData = Omit<ApprovalRequest, 'input_data'> & {
  input_data?: ApprovalRequest['input_data'];
};

interface ApprovalRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ApprovalHistoryItem | null;
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

const getResultMeta = (result?: ApprovalHistoryItem['result']) => {
  switch (result?.result) {
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
        description: '관리자 검토를 기다리는 요청입니다. Issue #222 계약 기준으로 이 화면은 요청 메타데이터와 처리 결과 중심으로 표시합니다.',
      };
  }
};

export const ApprovalRequestDetailModal = ({
  isOpen,
  onClose,
  item,
}: ApprovalRequestDetailModalProps) => {
  if (!item) return null;

  const request = item.request as ApprovalRequestWithOptionalInputData;
  const resourceInputs = request.input_data?.resource_inputs ?? [];
  const selectedCount = resourceInputs.filter((resource) => resource.selected).length;
  const excludedCount = resourceInputs.length - selectedCount;
  const hasSnapshotSummary = resourceInputs.length > 0;
  const resultMeta = getResultMeta(item.result);

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
            <span className={cn('text-xs', textColors.tertiary)}>요청 ID {request.id}</span>
          </div>
          <p className={cn('text-sm leading-6', resultMeta.panelText)}>{resultMeta.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청자</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{request.requested_by}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청 시각</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{formatDateTime(request.requested_at)}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>처리 시각</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{formatDateTime(item.result?.processed_at)}</p>
          </div>
        </div>

        {hasSnapshotSummary ? (
          <div className="grid grid-cols-2 gap-3">
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>포함 리소스 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{selectedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>legacy 응답에 포함된 참고 요약</p>
            </div>
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>제외 리소스 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{excludedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>
                기본 제외 사유 {request.input_data?.exclusion_reason_default ?? '-'}
              </p>
            </div>
          </div>
        ) : (
          <div className={cn('rounded-xl border p-4 space-y-2', statusColors.info.bg, statusColors.info.border)}>
            <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
              상세 입력 스냅샷 없이 요약만 제공됩니다
            </p>
            <p className={cn('text-sm leading-6', statusColors.info.text)}>
              Issue #222 계약 기준으로 `approval-history`와 `approval-requests/latest` 응답에는 `resource_inputs`가 포함되지 않을 수 있습니다.
              이 화면은 요청 메타데이터와 승인 처리 결과를 빠르게 확인하는 용도로 유지합니다.
            </p>
          </div>
        )}

        {item.result && (
          <div className={cn('rounded-xl border p-4 space-y-3', borderColors.default, bgColors.muted)}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn('text-sm font-semibold', textColors.primary)}>처리 결과 요약</p>
              <Badge variant={resultMeta.badgeVariant}>{item.result.result}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className={cn('text-xs font-medium', textColors.tertiary)}>처리자</p>
                <p className={cn('text-sm', textColors.secondary)}>{item.result.process_info.user_id ?? '시스템'}</p>
              </div>
              <div className="space-y-1">
                <p className={cn('text-xs font-medium', textColors.tertiary)}>처리 시각</p>
                <p className={cn('text-sm', textColors.secondary)}>{formatDateTime(item.result.processed_at)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className={cn('text-xs font-medium', textColors.tertiary)}>메모</p>
              <p className={cn('text-sm leading-6', textColors.secondary)}>
                {item.result.process_info.reason ?? '추가 메모가 없습니다.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
