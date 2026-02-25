'use client';

import { Badge } from '@/app/components/ui/Badge';
import { RequestTypeBadge } from '@/app/components/features/queue-board/RequestTypeBadge';
import { CloudInfoCell } from '@/app/components/features/queue-board/CloudInfoCell';
import { formatDateTime } from '@/app/components/features/queue-board/utils';
import { tableStyles, buttonStyles, cn, textColors, statusColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem } from '@/lib/types/queue-board';

interface PendingTasksTableProps {
  items: ApprovalRequestQueueItem[];
  loading: boolean;
  onApprove: (item: ApprovalRequestQueueItem) => void;
  onReject: (item: ApprovalRequestQueueItem) => void;
  onDetail: (item: ApprovalRequestQueueItem) => void;
}

const COLUMNS = ['요청유형', '서비스코드', '서비스명', 'Provider', 'Cloud 정보', '요청시간', 'Action'] as const;

export const PendingTasksTable = ({ items, loading, onApprove, onReject, onDetail }: PendingTasksTableProps) => {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className={cn('w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3', statusColors.info.border)} />
        <p className={cn('text-sm', textColors.tertiary)}>로딩 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className={textColors.tertiary}>미처리 승인 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className={tableStyles.header}>
            {COLUMNS.map((col) => (
              <th key={col} className={tableStyles.headerCell}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {items.map((item) => (
            <tr key={item.approvalRequestId} className={tableStyles.row}>
              <td className={tableStyles.cell}>
                <RequestTypeBadge
                  requestType={item.requestType}
                  requestTypeName={item.requestTypeName}
                  statusSuffix="미처리"
                  statusVariant="pending"
                />
              </td>
              <td className={cn(tableStyles.cell, 'font-medium', textColors.primary)}>
                {item.serviceCode}
              </td>
              <td className={cn(tableStyles.cell, textColors.secondary)}>
                {item.serviceName}
              </td>
              <td className={tableStyles.cell}>
                <Badge variant={item.provider === 'AWS' ? 'aws' : item.provider === 'IDC' ? 'idc' : 'neutral'} size="sm">
                  {item.provider}
                </Badge>
              </td>
              <td className={tableStyles.cell}>
                <CloudInfoCell provider={item.provider} cloudInfo={item.cloudInfo} />
              </td>
              <td className={cn(tableStyles.cell, 'text-sm', textColors.tertiary, 'whitespace-nowrap')}>
                {formatDateTime(item.requestedAt)}
              </td>
              <td className={tableStyles.cell}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApprove(item)}
                    className={cn(buttonStyles.base, buttonStyles.variants.primary, buttonStyles.sizes.sm)}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(item)}
                    className={cn(
                      buttonStyles.base,
                      buttonStyles.sizes.sm,
                      'border',
                      statusColors.error.border,
                      statusColors.error.text,
                      'bg-transparent hover:bg-red-50', // no hover token in theme for error bg
                    )}
                  >
                    반려
                  </button>
                  <button
                    type="button"
                    onClick={() => onDetail(item)}
                    className={cn(buttonStyles.base, buttonStyles.variants.ghost, buttonStyles.sizes.sm)}
                  >
                    상세
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
