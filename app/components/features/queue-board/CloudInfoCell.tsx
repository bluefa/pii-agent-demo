'use client';

import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

interface CloudInfoCellProps {
  provider: CloudProvider;
  cloudInfo: string;
}

/**
 * Provider별 Cloud 식별 정보를 렌더링하는 테이블 셀.
 * - AWS: Account ID (12자리)
 * - Azure: "Tenant / Subscription" (truncate + title tooltip)
 * - GCP: Project ID
 * - SDU / IDC: 라벨만 표시
 */
export const CloudInfoCell = ({ provider, cloudInfo }: CloudInfoCellProps) => {
  const isSimpleLabel = provider === 'SDU' || provider === 'IDC';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <CloudProviderIcon provider={provider} size="sm" showLabel={false} />
      <span
        className={cn(
          'truncate max-w-[200px]',
          isSimpleLabel ? textColors.tertiary : textColors.secondary,
          isSimpleLabel ? 'text-xs' : 'text-sm',
          provider === 'AWS' && 'font-mono',
        )}
        title={cloudInfo}
      >
        {cloudInfo}
      </span>
    </div>
  );
};
