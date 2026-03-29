'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { textColors, statusColors, cn, getInputClass, borderColors, bgColors } from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import type { ApprovalResourceInput } from '@/app/lib/api';
import { ProcessStatus } from '@/lib/types';

interface ApprovalRequest {
  id: string;
  requested_at: string;
  requested_by: string;
  input_data?: {
    resource_inputs?: ApprovalResourceInput[];
    exclusion_reason_default?: string;
  };
}

interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  approvalRequest: ApprovalRequest;
  onApprove: () => void;
  onReject: (reason: string) => void;
  loading: boolean;
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

export const ApprovalDetailModal = ({
  isOpen,
  onClose,
  project,
  approvalRequest,
  onApprove,
  onReject,
  loading,
}: ApprovalDetailModalProps) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isWaitingApproval = project.processStatus === ProcessStatus.WAITING_APPROVAL;
  const resourceInputs = approvalRequest.input_data?.resource_inputs ?? [];
  const includedCount = resourceInputs.filter((resource) => resource.selected).length;
  const excludedCount = resourceInputs.length - includedCount;
  const hasSnapshotSummary = resourceInputs.length > 0;

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) return;
    onReject(rejectReason.trim());
  };

  const handleClose = () => {
    setShowRejectForm(false);
    setRejectReason('');
    onClose();
  };

  const footer = isWaitingApproval ? (
    showRejectForm ? (
      <>
        <Button
          variant="secondary"
          onClick={() => setShowRejectForm(false)}
          disabled={loading}
        >
          취소
        </Button>
        <Button
          variant="danger"
          onClick={handleRejectSubmit}
          disabled={loading || !rejectReason.trim()}
        >
          {loading && <LoadingSpinner size="sm" />}
          반려하기
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={handleClose}>
          닫기
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowRejectForm(true)}
          disabled={loading}
        >
          반려
        </Button>
        <Button onClick={onApprove} disabled={loading}>
          {loading && <LoadingSpinner size="sm" />}
          승인
        </Button>
      </>
    )
  ) : (
    <Button variant="secondary" onClick={handleClose}>
      닫기
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="승인 요청 요약"
      subtitle={project.projectCode}
      size="2xl"
      footer={footer}
    >
      <div className="space-y-6">
        <div className={cn(
          'rounded-xl border p-4 space-y-3',
          isWaitingApproval ? statusColors.info.bg : project.isRejected ? statusColors.error.bg : statusColors.success.bg,
          isWaitingApproval ? statusColors.info.border : project.isRejected ? statusColors.error.border : statusColors.success.border,
        )}>
          <div className="flex items-center justify-between gap-3">
            <Badge variant={isWaitingApproval ? 'info' : project.isRejected ? 'error' : 'success'} dot>
              {isWaitingApproval ? '승인 대기' : project.isRejected ? '반려됨' : '승인됨'}
            </Badge>
            <span className={cn('text-xs', textColors.tertiary)}>Target Source {project.targetSourceId}</span>
          </div>
          <p className={cn(
            'text-sm leading-6',
            isWaitingApproval ? statusColors.info.textDark : project.isRejected ? statusColors.error.textDark : statusColors.success.textDark,
          )}>
            {isWaitingApproval
              ? 'Issue #222 계약 기준으로 승인 상세는 요청 메타와 현재 상태 중심으로 검토합니다. 세부 선택 목록은 별도 상세 API 없이 보장되지 않습니다.'
              : project.isRejected
                ? '반려된 요청입니다. 아래 요약과 반려 사유를 기준으로 다시 요청 여부를 판단할 수 있습니다.'
                : '승인된 요청입니다. 실제 적용 대상은 이후 approved/confirmed snapshot에서 확인하는 흐름을 기준으로 합니다.'}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청자</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{approvalRequest.requested_by}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청 시각</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{formatDateTime(approvalRequest.requested_at)}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>요청 ID</p>
            <p className={cn('text-sm font-mono', textColors.secondary)}>{approvalRequest.id}</p>
          </div>
          <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default, bgColors.muted)}>
            <p className={cn('text-xs font-medium', textColors.tertiary)}>현재 리소스 수</p>
            <p className={cn('text-sm font-semibold', textColors.primary)}>{project.resourceCount}</p>
          </div>
        </div>

        {hasSnapshotSummary ? (
          <div className="grid grid-cols-3 gap-3">
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>포함 리소스 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{includedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>legacy 응답에 포함된 참고 요약</p>
            </div>
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>제외 리소스 수</p>
              <p className={cn('text-2xl font-semibold', textColors.primary)}>{excludedCount}</p>
              <p className={cn('text-xs', textColors.tertiary)}>승인 검토용 요약</p>
            </div>
            <div className={cn('rounded-lg border p-4 space-y-1', borderColors.default)}>
              <p className={cn('text-xs font-medium', textColors.tertiary)}>기본 제외 사유</p>
              <p className={cn('text-sm leading-6', textColors.secondary)}>
                {approvalRequest.input_data?.exclusion_reason_default ?? '-'}
              </p>
            </div>
          </div>
        ) : (
          <div className={cn('rounded-xl border p-4 space-y-2', statusColors.info.bg, statusColors.info.border)}>
            <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
              세부 선택 스냅샷은 응답 계약에 포함되지 않습니다
            </p>
            <p className={cn('text-sm leading-6', statusColors.info.text)}>
              승인 대기/승인 상세는 request 메타데이터와 현재 대상 소스 상태 중심으로 검토합니다.
              실제 적용 대상 검증은 이후 approved/confirmed snapshot 계열 API를 기준으로 이어집니다.
            </p>
          </div>
        )}

        {project.isRejected && project.rejectionReason && (
          <div className={cn('rounded-xl border p-4 space-y-1', statusColors.error.bg, statusColors.error.border)}>
            <p className={cn('text-xs font-medium', statusColors.error.textDark)}>최근 반려 사유</p>
            <p className={cn('text-sm leading-6', statusColors.error.textDark)}>{project.rejectionReason}</p>
          </div>
        )}

        {showRejectForm && (
          <div>
            <label className={cn('block text-sm font-medium mb-2', textColors.secondary)}>
              반려 사유 <span className={statusColors.error.text}>*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요..."
              className={cn(getInputClass(), 'resize-none')}
              rows={3}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
