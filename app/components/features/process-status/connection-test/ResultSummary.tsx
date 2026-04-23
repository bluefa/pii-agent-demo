'use client';

import type { TestConnectionJob } from '@/app/lib/api';
import { statusColors, textColors, borderColors, cn } from '@/lib/theme';
import { TEXT_LINK_CLASS } from './constants';

interface ResultSummaryProps {
  job: TestConnectionJob;
  isShaking: boolean;
  onShowDetail: () => void;
}

export const ResultSummary = ({ job, isShaking, onShowDetail }: ResultSummaryProps) => {
  const successCount = job.resource_results.filter((r) => r.status === 'SUCCESS').length;
  const failCount = job.resource_results.filter((r) => r.status === 'FAIL').length;
  const isSuccess = job.status === 'SUCCESS';
  const dateStr = new Date(job.completed_at ?? job.requested_at ?? '').toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={cn('space-y-2', isShaking && 'animate-shake')}>
      <span className={cn('text-xs font-semibold uppercase tracking-wide', textColors.tertiary)}>최근 테스트 결과</span>
      <div className={cn('flex items-center gap-2 px-3 py-2.5 bg-white rounded-lg border', borderColors.default)}>
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          isSuccess ? statusColors.success.dot : statusColors.error.dot,
        )} />
        <span className={cn('text-sm flex-1', textColors.secondary)}>
          {isSuccess
            ? `${successCount}개 성공`
            : `${successCount}개 성공, ${failCount}개 실패`}
          <span className="mx-1.5 opacity-50">·</span>
          <span className={textColors.quaternary}>{dateStr}</span>
        </span>
        <button onClick={onShowDetail} className={TEXT_LINK_CLASS}>
          상세 보기 →
        </button>
      </div>
    </div>
  );
};
