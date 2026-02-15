'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { getScanHistory } from '@/app/lib/api/scan';
import { cn, statusColors, textColors, bgColors, borderColors } from '@/lib/theme';
import { formatDate, formatDuration } from '@/lib/utils/date';
import type { V1ScanHistoryResponse } from '@/app/lib/api/scan';
import type { V1ScanJob } from '@/lib/types';

interface ScanHistoryListProps {
  targetSourceId: number;
  limit?: number;
  lastCompletedAt?: string;
}

type HistoryItem = V1ScanJob;

const ChevronDownIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={cn('w-3.5 h-3.5 transition-transform duration-200', expanded && 'rotate-180')}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ExpandedDetail = ({ item }: { item: HistoryItem }) => {
  if (item.scanStatus === 'FAIL') {
    return (
      <tr>
        <td colSpan={5} className="px-0 py-0">
          <div className={cn('mx-3 mb-2 px-3 py-2 rounded-md border-l-4 flex items-start gap-2', statusColors.error.bg, statusColors.error.border)}>
            <svg className={cn('w-4 h-4 mt-0.5 flex-shrink-0', statusColors.error.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={cn('text-xs', statusColors.error.textDark)}>
              {item.scanError || '알 수 없는 오류가 발생했습니다.'}
            </span>
          </div>
        </td>
      </tr>
    );
  }

  const resourceTypes = Object.entries(item.resourceCountByResourceType);
  if (resourceTypes.length === 0) return null;

  return (
    <tr>
      <td colSpan={5} className="px-0 py-0">
        <div className={cn('mx-3 mb-2 px-3 py-2 rounded-md border-l-4', statusColors.info.bg, statusColors.info.border)}>
          <div className={cn('text-xs mb-1.5', textColors.tertiary)}>리소스 타입별</div>
          <div className="flex flex-wrap gap-1.5">
            {resourceTypes.map(([resourceType, count]) => (
              <span
                key={resourceType}
                className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded', bgColors.muted, textColors.secondary)}
              >
                <span className="font-medium">{resourceType}</span>
                <span className={textColors.tertiary}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
};

export const ScanHistoryList = ({ targetSourceId, limit = 5, lastCompletedAt }: ScanHistoryListProps) => {
  const [data, setData] = useState<V1ScanHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getScanHistory(targetSourceId, 0, limit);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [targetSourceId, limit, lastCompletedAt]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, lastCompletedAt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className={cn('w-5 h-5 border-2 rounded-full animate-spin', borderColors.default, 'border-t-blue-500')} />
        <span className={cn('ml-2 text-sm', textColors.tertiary)}>이력 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className={cn('text-sm', statusColors.error.text)}>이력을 불러오는데 실패했습니다.</p>
        <button onClick={fetchHistory} className={cn('mt-2 text-sm', statusColors.info.text, 'hover:underline')}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.content.length === 0) {
    return (
      <div className={cn('text-center py-8 text-sm', textColors.tertiary)}>
        스캔 이력이 없습니다.
      </div>
    );
  }

  const hasExpandableContent = (item: HistoryItem) =>
    item.scanStatus === 'FAIL' || Object.keys(item.resourceCountByResourceType).length > 0;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b text-left text-xs font-medium uppercase', borderColors.default, textColors.tertiary)}>
            <th className="px-3 py-2">일시</th>
            <th className="px-3 py-2">소요시간</th>
            <th className="px-3 py-2 text-right">발견</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody className={cn('divide-y', 'divide-gray-100')}>
          {data.content.map((item) => {
            const itemId = String(item.id);
            const isExpanded = expandedId === itemId;
            const expandable = hasExpandableContent(item);
            const totalFound = Object.values(item.resourceCountByResourceType).reduce((s, c) => s + c, 0);
            const statusConfig = item.scanStatus === 'SUCCESS'
              ? { bg: statusColors.success.bg, text: statusColors.success.textDark, dot: statusColors.success.dot, label: '완료' }
              : { bg: statusColors.error.bg, text: statusColors.error.textDark, dot: statusColors.error.dot, label: '실패' };

            return (
              <Fragment key={itemId}>
                <tr
                  className={cn(
                    'transition-colors',
                    expandable && 'cursor-pointer hover:bg-gray-50',
                    isExpanded && bgColors.muted,
                  )}
                  onClick={() => expandable && toggleExpand(itemId)}
                  onKeyDown={(e) => { if (expandable && (e.key === 'Enter' || e.key === ' ')) toggleExpand(itemId); }}
                  tabIndex={expandable ? 0 : undefined}
                  role={expandable ? 'button' : undefined}
                  aria-expanded={expandable ? isExpanded : undefined}
                >
                  <td className={cn('px-3 py-2', textColors.secondary)}>
                    {formatDate(item.updatedAt, 'short')}
                  </td>
                  <td className={cn('px-3 py-2', textColors.tertiary)}>
                    {formatDuration(item.durationSeconds)}
                  </td>
                  <td className={cn('px-3 py-2 text-right', textColors.secondary)}>
                    {totalFound || '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', statusConfig.bg, statusConfig.text)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className={cn('px-3 py-2 text-center', textColors.quaternary)}>
                    {expandable && <ChevronDownIcon expanded={isExpanded} />}
                  </td>
                </tr>
                {isExpanded && <ExpandedDetail item={item} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {data.page.totalElements > limit && (
        <div className={cn('text-center py-2 text-xs border-t', textColors.tertiary, 'border-gray-100')}>
          총 {data.page.totalElements}건 중 최근 {limit}건 표시
        </div>
      )}
    </div>
  );
};

export default ScanHistoryList;
