'use client';

import { useState } from 'react';
import type { TestConnectionJob } from '@/app/lib/api';
import { statusColors, textColors, borderColors, cn } from '@/lib/theme';
import { ResourceResultRow } from './ResourceResultRow';

interface HistoryJobCardProps {
  job: TestConnectionJob;
}

export const HistoryJobCard = ({ job }: HistoryJobCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = job.status === 'SUCCESS';
  const isFail = job.status === 'FAIL';
  const failCount = isFail ? job.resource_results.filter((r) => r.status === 'FAIL').length : 0;
  const dateStr = new Date(job.requested_at ?? job.completed_at ?? '').toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className={cn('border rounded-lg overflow-hidden', borderColors.default)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full',
            isSuccess ? statusColors.success.dot : isFail ? statusColors.error.dot : statusColors.pending.dot,
          )} />
          <span className={cn('text-sm font-medium', textColors.secondary)}>{dateStr}</span>
          <span className={cn(
            'text-xs font-medium',
            isSuccess ? statusColors.success.text : isFail ? statusColors.error.text : statusColors.pending.text,
          )}>
            {isSuccess ? '성공' : isFail ? `실패 (${failCount}건)` : '진행 중'}
          </span>
        </div>
        <svg className={cn('w-4 h-4 transition-transform', textColors.quaternary, expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && job.resource_results.length > 0 && (
        <div className="max-h-[200px] overflow-auto">
          {job.resource_results.map((r) => (
            <ResourceResultRow key={r.resource_id} result={r} />
          ))}
        </div>
      )}
    </div>
  );
};
