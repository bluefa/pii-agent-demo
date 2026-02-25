'use client';

import { Badge } from '@/app/components/ui/Badge';
import { RequestTypeBadge } from '@/app/components/features/queue-board/RequestTypeBadge';
import { CloudInfoCell } from '@/app/components/features/queue-board/CloudInfoCell';
import { formatDateTime } from '@/app/components/features/queue-board/utils';
import { tableStyles, buttonStyles, cn, textColors, statusColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem } from '@/lib/types/queue-board';

interface ProcessingTasksTableProps {
  items: ApprovalRequestQueueItem[];
  loading: boolean;
  onDetail: (item: ApprovalRequestQueueItem) => void;
}

const COLUMNS = ['요청유형', '서비스코드', '서비스명', 'Provider', 'Cloud 정보', '승인시간', '처리상태', 'Action'] as const;

export const ProcessingTasksTable = ({ items, loading, onDetail }: ProcessingTasksTableProps) => {
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className={textColors.tertiary}>처리 중인 요청이 없습니다</p>
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
                  statusSuffix={item.statusLabel ?? '반영중'}
                  statusVariant="processing"
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
                {item.processedAt ? formatDateTime(item.processedAt) : '-'}
              </td>
              <td className={tableStyles.cell}>
                <Badge variant="warning" size="sm" dot>
                  {item.statusLabel ?? '처리중'}
                </Badge>
              </td>
              <td className={tableStyles.cell}>
                <button
                  type="button"
                  onClick={() => onDetail(item)}
                  className={cn(buttonStyles.base, buttonStyles.variants.ghost, buttonStyles.sizes.sm)}
                >
                  상세
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
