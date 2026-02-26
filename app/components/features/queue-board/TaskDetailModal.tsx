'use client';

import Link from 'next/link';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { CloudInfoCell } from '@/app/components/features/queue-board/CloudInfoCell';
import { cn, textColors, statusColors, primaryColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem, ApprovalRequestStatus } from '@/lib/types/queue-board';
import type { BadgeVariant } from '@/app/components/ui/Badge';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ApprovalRequestQueueItem | null;
}

const STATUS_BADGE_MAP: Record<ApprovalRequestStatus, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: 'pending', label: '미처리' },
  IN_PROGRESS: { variant: 'warning', label: '처리중' },
  APPROVED: { variant: 'success', label: '승인' },
  REJECTED: { variant: 'error', label: '반려' },
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${min}`;
};

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

const DetailRow = ({ label, children }: DetailRowProps) => (
  <div className="flex py-2.5 border-b border-gray-50 last:border-b-0">
    <dt className={cn('w-28 flex-shrink-0 text-sm', textColors.tertiary)}>
      {label}
    </dt>
    <dd className={cn('flex-1 text-sm', textColors.primary)}>
      {children}
    </dd>
  </div>
);

export const TaskDetailModal = ({
  isOpen,
  onClose,
  item,
}: TaskDetailModalProps) => {
  if (!item) return null;

  const statusInfo = STATUS_BADGE_MAP[item.status];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="요청 상세"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Link
            href={`/projects/${item.targetSourceId}`}
            className={cn('text-sm font-medium', primaryColors.text, primaryColors.textHover)}
          >
            해당 시스템 상세 보기
          </Link>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <dl className="divide-y-0">
        <DetailRow label="요청 유형">
          {item.requestTypeName}
        </DetailRow>

        <DetailRow label="서비스코드">
          <span className="font-mono">{item.serviceCode}</span>
        </DetailRow>

        <DetailRow label="서비스명">
          {item.serviceName}
        </DetailRow>

        <DetailRow label="Cloud">
          <CloudInfoCell provider={item.provider} cloudInfo={item.cloudInfo} />
        </DetailRow>

        <DetailRow label="상태">
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.variant} size="sm" dot>
              {statusInfo.label}
            </Badge>
            {item.statusLabel && (
              <span className={cn('text-xs', textColors.tertiary)}>
                {item.statusLabel}
              </span>
            )}
          </div>
        </DetailRow>

        <DetailRow label="요청 시간">
          {formatDateTime(item.requestedAt)}
        </DetailRow>

        <DetailRow label="요청자">
          {item.requestedBy}
        </DetailRow>

        {item.processedAt && (
          <DetailRow label="처리 시간">
            {formatDateTime(item.processedAt)}
          </DetailRow>
        )}

        {item.processedBy && (
          <DetailRow label="처리자">
            {item.processedBy}
          </DetailRow>
        )}

        {item.rejectionReason && (
          <DetailRow label="반려 사유">
            <span className={statusColors.error.text}>{item.rejectionReason}</span>
          </DetailRow>
        )}
      </dl>
    </Modal>
  );
};
