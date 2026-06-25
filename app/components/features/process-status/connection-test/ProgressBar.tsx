'use client';

import type { TestConnectionVersionResult } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { primaryColors, textColors, bgColors, cn } from '@/lib/theme';

interface ProgressBarProps {
  job: TestConnectionVersionResult;
  totalResources: number;
}

export const ProgressBar = ({ job, totalResources }: ProgressBarProps) => {
  const completed = (job.test_connection_agent_results ?? []).length;
  const total = totalResources || completed || 1;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" className={primaryColors.text} />
          <span className={cn('font-medium', textColors.secondary)}>연결 테스트 진행 중...</span>
        </div>
        <span className={textColors.tertiary}>{completed}/{total} 리소스 완료</span>
      </div>
      <div className={cn('w-full h-2 rounded-full overflow-hidden', bgColors.divider)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', primaryColors.bg)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
