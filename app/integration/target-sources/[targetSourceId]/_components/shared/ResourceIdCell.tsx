'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { cn, textColors } from '@/lib/theme';

interface ResourceIdCellProps {
  value: string;
  /** Copy-button aria label prefix, e.g. "Resource ID". */
  label: string;
  maxWidthClass?: string;
}

/**
 * Long Resource ID / ARN / ARM-id cell — ellipsis truncation + copy-on-hover +
 * full-value tooltip. v15 `.res-id-cell` / `.res-id-text` (5743). Mirrors the IDC
 * `HostCell` so cloud tables truncate long ids the same way IDC truncates hosts.
 */
export const ResourceIdCell = ({
  value,
  label,
  maxWidthClass = 'max-w-[260px]',
}: ResourceIdCellProps) => (
  <span className={cn('group/resid inline-flex items-center gap-1.5 min-w-0', maxWidthClass)}>
    <Tooltip content={value} size="md" triggerClassName="min-w-0 overflow-hidden">
      <span
        className={cn(
          // v16 .res-id-text: rtl direction + left align truncates from the LEFT, keeping the
          // distinguishing tail (…/servers/mysql-prod-01) visible instead of the common prefix.
          'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-left [direction:rtl]',
          textColors.secondary,
        )}
      >
        {value}
      </span>
    </Tooltip>
    <CopyButton
      value={value}
      label={`${label} 복사`}
      className="shrink-0 opacity-0 group-hover/resid:opacity-100"
    />
  </span>
);
