'use client';

import type { TestConnectionResourceResult } from '@/app/lib/api';
import { statusColors, textColors, cn } from '@/lib/theme';

interface ResourceResultRowProps {
  result: TestConnectionResourceResult;
}

export const ResourceResultRow = ({ result }: ResourceResultRowProps) => {
  const isSuccess = result.status === 'SUCCESS';
  const isFail = result.status === 'FAIL';

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className={cn(
        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
        isSuccess ? statusColors.success.dot : statusColors.error.dot,
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium uppercase', textColors.quaternary)}>{result.resource_type}</span>
          <span className={cn('text-sm font-mono truncate', textColors.secondary)}>{result.resource_id}</span>
        </div>
        {isFail && (
          <div className={cn('mt-1 text-xs', textColors.tertiary)}>
            <span className="font-medium">{result.error_status}</span>
            {result.guide ? (
              <span className="ml-1">— {result.guide}</span>
            ) : (
              <span className={cn('ml-1', textColors.quaternary)}>— 가이드: 미지원</span>
            )}
          </div>
        )}
      </div>
      <span className={cn(
        'text-xs font-medium flex-shrink-0',
        isSuccess ? statusColors.success.text : statusColors.error.text,
      )}>
        {isSuccess ? '성공' : '실패'}
      </span>
    </div>
  );
};
