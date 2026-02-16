'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { tableStyles, textColors, cn, getInputClass } from '@/lib/theme';
import type { ProjectSummary, Resource } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';

interface ApprovalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSummary;
  resources: Resource[];
  requestedBy?: string;
  requestedAt?: string;
  requestId?: string;
  onApprove: () => void;
  onReject: (reason: string) => void;
  loading: boolean;
}

const formatEndpoint = (r: Resource): string => {
  if (!r.vmDatabaseConfig) return '-';
  const { host, port, databaseType } = r.vmDatabaseConfig;
  const endpoint = host ? `${host}:${port}` : `${port}`;
  return databaseType ? `${databaseType} ${endpoint}` : endpoint;
};

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
  resources,
  requestedBy,
  requestedAt,
  requestId,
  onApprove,
  onReject,
  loading,
}: ApprovalDetailModalProps) => {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isWaitingApproval = project.processStatus === ProcessStatus.WAITING_APPROVAL;
  const includedResources = resources.filter((r) => r.isSelected);
  const excludedResources = resources.filter((r) => !r.isSelected);

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
      title="승인요청 상세"
      subtitle={project.projectCode}
      size="2xl"
      footer={footer}
    >
      <div className="space-y-6">
        {/* 요청 메타 정보 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className={cn('text-xs font-medium mb-1', textColors.tertiary)}>요청자</p>
            <p className={cn('text-sm font-medium', textColors.primary)}>{requestedBy ?? '-'}</p>
          </div>
          <div>
            <p className={cn('text-xs font-medium mb-1', textColors.tertiary)}>요청 시각</p>
            <p className={cn('text-sm font-medium', textColors.primary)}>{formatDateTime(requestedAt)}</p>
          </div>
          <div>
            <p className={cn('text-xs font-medium mb-1', textColors.tertiary)}>요청 ID</p>
            <p className={cn('text-sm font-mono', textColors.tertiary)}>{requestId ?? '-'}</p>
          </div>
        </div>

        {/* 상태 뱃지 */}
        {!isWaitingApproval && (
          <div>
            <Badge variant={project.isRejected ? 'error' : 'success'} dot>
              {project.isRejected ? '반려됨' : '승인됨'}
            </Badge>
            {project.isRejected && project.rejectionReason && (
              <p className={cn('text-sm mt-2', textColors.tertiary)}>
                반려 사유: {project.rejectionReason}
              </p>
            )}
          </div>
        )}

        {/* 포함 리소스 */}
        <div>
          <h4 className={cn('text-sm font-semibold mb-2', textColors.primary)}>
            포함 리소스 ({includedResources.length})
          </h4>
          {includedResources.length === 0 ? (
            <p className={cn('text-sm py-4 text-center', textColors.quaternary)}>
              포함된 리소스가 없습니다
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className={tableStyles.header}>
                    <th className={tableStyles.headerCell}>리소스 ID</th>
                    <th className={tableStyles.headerCell}>유형</th>
                    <th className={tableStyles.headerCell}>Endpoint</th>
                    <th className={tableStyles.headerCell}>Credential</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {includedResources.map((r) => (
                    <tr key={r.id} className={tableStyles.row}>
                      <td className={cn(tableStyles.cell, 'text-sm font-mono', textColors.primary)}>
                        {r.resourceId}
                      </td>
                      <td className={cn(tableStyles.cell, 'text-sm', textColors.secondary)}>
                        {r.type}
                      </td>
                      <td className={cn(tableStyles.cell, 'text-sm font-mono', textColors.tertiary)}>
                        {formatEndpoint(r)}
                      </td>
                      <td className={cn(tableStyles.cell, 'text-sm font-mono', textColors.tertiary)}>
                        {r.selectedCredentialId ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 제외 리소스 */}
        <div>
          <h4 className={cn('text-sm font-semibold mb-2', textColors.primary)}>
            제외 리소스 ({excludedResources.length})
          </h4>
          {excludedResources.length === 0 ? (
            <p className={cn('text-sm py-4 text-center', textColors.quaternary)}>
              제외된 리소스가 없습니다
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className={tableStyles.header}>
                    <th className={tableStyles.headerCell}>리소스 ID</th>
                    <th className={tableStyles.headerCell}>유형</th>
                    <th className={tableStyles.headerCell}>제외 사유</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.body}>
                  {excludedResources.map((r) => (
                    <tr key={r.id} className={tableStyles.row}>
                      <td className={cn(tableStyles.cell, 'text-sm font-mono', textColors.primary)}>
                        {r.resourceId}
                      </td>
                      <td className={cn(tableStyles.cell, 'text-sm', textColors.secondary)}>
                        {r.type}
                      </td>
                      <td className={cn(tableStyles.cell, 'text-sm', textColors.tertiary)}>
                        {r.exclusion?.reason ?? '자동 제외'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 반려 사유 입력 */}
        {showRejectForm && (
          <div>
            <label className={cn('block text-sm font-medium mb-2', textColors.secondary)}>
              반려 사유 <span className="text-red-500">*</span>
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
