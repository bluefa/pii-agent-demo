'use client';

import { statusColors, textColors, bgColors, cn } from '@/lib/theme';
import type { ScanResult } from '@/lib/types';

interface ScanResultSummaryProps {
  result: ScanResult;
  completedAt?: string;
  onClose?: () => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
};

export const ScanResultSummary = ({ result, completedAt, onClose }: ScanResultSummaryProps) => (
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full', statusColors.success.dot)} />
        <span className={cn('text-sm font-medium', textColors.secondary)}>스캔 결과</span>
        {completedAt && (
          <span className={cn('text-xs', textColors.tertiary)}>({formatDate(completedAt)})</span>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn('transition-colors', textColors.quaternary, 'hover:text-gray-600')}
          aria-label="닫기"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>

    {/* Total Found + Type Breakdown */}
    <div className="flex items-start gap-6">
      <div className={cn('rounded-lg border px-5 py-3 text-center flex-shrink-0', statusColors.info.bg, statusColors.info.border)}>
        <div className={cn('text-2xl font-bold', statusColors.info.textDark)}>{result.totalFound}</div>
        <div className={cn('text-xs mt-1', statusColors.info.text)}>전체 발견</div>
      </div>

      {result.byResourceType.length > 0 && (
        <div className="flex-1 min-w-0">
          <div className={cn('text-xs mb-2', textColors.tertiary)}>리소스 타입별</div>
          <div className="flex flex-wrap gap-2">
            {result.byResourceType.map(({ resourceType, count }) => (
              <span
                key={resourceType}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 text-xs rounded',
                  bgColors.muted, textColors.secondary
                )}
              >
                <span className="font-medium">{resourceType}</span>
                <span className={textColors.tertiary}>({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default ScanResultSummary;
