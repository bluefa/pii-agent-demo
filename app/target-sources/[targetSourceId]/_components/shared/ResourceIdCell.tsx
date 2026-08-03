'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { cn, textColors } from '@/lib/theme';

interface ResourceIdCellProps {
  value: string;
  /** Field name, e.g. "Resource ID" — titles the tooltip and prefixes the copy-button aria label. */
  label: string;
  maxWidthClass?: string;
  /** Text classes on the id text. When given it REPLACES the default secondary resting color
   *  (`cn` is a plain join, so stacking two text colors would leave the winner to CSS order) —
   *  the approval table passes its own resting tier plus the row-hover contrast lift. */
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
      {/* Truncates from the RIGHT, like the Resource Name cell next to it (`truncate`):
          one abbreviation grammar per table — `Prefix…` — instead of an id that starts
          with `…` while the name beside it ends with one (owner call). The full value
          is one hover away, and the copy button hands over the exact string. */}
      <span className="block min-w-0 truncate text-left">
        {/* Styling lives HERE, on the node that owns the text, so class assertions and
            the truncation box do not fight over one element. */}
        <span className={cn('font-mono text-[12px]', textClassName ?? textColors.secondary)}>
          {value}
        </span>
      </span>
    </Tooltip>
    <CopyButton
      value={value}
      label={`${label} 복사`}
      className="shrink-0 opacity-0 group-hover/resid:opacity-100"
    />
  </span>
);
