'use client';

import { ScanResult } from '@/lib/types';
import { cn } from '@/lib/theme';

interface ScanResultSummaryProps {
  result: ScanResult;
  completedAt?: string;
  onClose?: () => void;
}

interface SummaryCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'orange' | 'red';
}

const SummaryCard = ({ label, value, color }: SummaryCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={cn('rounded-lg border p-3 text-center', colorClasses[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  );
};

export const ScanResultSummary = ({ result, completedAt, onClose }: ScanResultSummaryProps) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-medium text-gray-700">스캔 결과</span>
          {completedAt && (
            <span className="text-xs text-gray-500">({formatDate(completedAt)})</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="전체 발견" value={result.totalFound} color="blue" />
        <SummaryCard label="신규" value={result.newFound} color="green" />
        <SummaryCard label="업데이트" value={result.updated} color="orange" />
        <SummaryCard label="제거" value={result.removed} color="red" />
      </div>

      {/* Resource Type Breakdown */}
      {result.byResourceType.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500 mb-2">리소스 타입별</div>
          <div className="flex flex-wrap gap-2">
            {result.byResourceType.map(({ resourceType, count }) => (
              <span
                key={resourceType}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
              >
                <span className="font-medium">{resourceType}</span>
                <span className="text-gray-500">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanResultSummary;
