'use client';

import type { TestConnectionAgentResult } from '@/app/lib/api';
import { statusColors, textColors, borderColors, cn } from '@/lib/theme';

interface ResourceResultRowProps {
  result: TestConnectionAgentResult;
}

// ADR-019 latest_version drops per-resource error_status/guide/resource_type
// (see migration spec §5.1); the row now shows the agent id + connection status.
export const ResourceResultRow = ({ result }: ResourceResultRowProps) => {
  const isSuccess = result.connection_status === 'SUCCESS';

  return (
    <div className={cn('flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0', borderColors.light)}>
      <span className={cn(
        'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
        isSuccess ? statusColors.success.dot : statusColors.error.dot,
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium uppercase', textColors.quaternary)}>{result.agent_id}</span>
          <span className={cn('text-sm font-mono truncate', textColors.secondary)}>{result.resource_id}</span>
        </div>
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
