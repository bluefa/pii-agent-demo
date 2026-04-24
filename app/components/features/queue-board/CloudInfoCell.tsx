'use client';

import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

interface CloudInfoCellProps {
  provider: CloudProvider;
  cloudInfo: string;
}

export const CloudInfoCell = ({ provider, cloudInfo }: CloudInfoCellProps) => (
  <div className="flex items-center gap-2 min-w-0">
    <CloudProviderIcon provider={provider} size="sm" showLabel={false} />
    <span
      className={cn(
        'truncate max-w-[200px]',
        textColors.secondary,
        'text-sm',
        provider === 'AWS' && 'font-mono',
      )}
      title={cloudInfo}
    >
      {cloudInfo}
    </span>
  </div>
);
