'use client';

import type { TestConnectionJob } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { primaryColors, cn } from '@/lib/theme';

interface ProgressBarProps {
  job: TestConnectionJob;
  totalResources: number;
}

export const ProgressBar = ({ job, totalResources }: ProgressBarProps) => {
  const completed = job.resource_results.length;
  const total = totalResources || completed || 1;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" className={primaryColors.text} />
          <span className="text-gray-700 font-medium">연결 테스트 진행 중...</span>
        </div>
        <span className="text-gray-500">{completed}/{total} 리소스 완료</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', primaryColors.bg)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
