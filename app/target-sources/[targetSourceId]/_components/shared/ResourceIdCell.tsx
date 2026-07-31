'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, textColors } from '@/lib/theme';

interface ResourceIdCellProps {
  value: string;
  /** Field name, e.g. "Resource ID" — titles the tooltip and prefixes the copy-button aria label. */
  label: string;
  maxWidthClass?: string;
  /** Extra classes on the id text — used by the approval table for its row-hover contrast lift. */
  textClassName?: string;
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
  textClassName,
}: ResourceIdCellProps) => (
  <span className={cn('group/resid inline-flex items-center gap-1.5 min-w-0', maxWidthClass)}>
    {/* Long ids are the norm here, but short ones exist — no tooltip when the value already fits. */}
    <Tooltip
      content={<IdentifierTip label={label} value={value} />}
      variant="value"
      size="md"
      triggerClassName="min-w-0 overflow-hidden"
      truncatedOnly
    >
      <span
        className={cn(
          // v16 .res-id-text: rtl direction + left align truncates from the LEFT, keeping the
          // distinguishing tail (…/servers/mysql-prod-01) visible instead of the common prefix.
          'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-left [direction:rtl]',
          textColors.secondary,
          textClassName,
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
