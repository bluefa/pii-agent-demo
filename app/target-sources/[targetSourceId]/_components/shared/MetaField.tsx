import { cn, textColors } from '@/lib/theme';

/**
 * One card-header meta pair (요청일시 / 승인자 …) — label over value, both 12px.
 * Only weight and color separate the tiers, so the pair still clears 4.5:1.
 * Deliberately not the page header's kv tier (14px, near-black): that one names
 * the target source itself, and this one sits below the 16px guidance copy.
 */
export const MetaField = ({
  label,
  value,
  inline = false,
}: {
  label: string;
  value: string;
  /**
   * Label beside the value instead of above it. Stacked pairs standing side by side read
   * ambiguously — the eye can bind a value to the label above it OR to the pair on its right —
   * so a row of several pairs sets this and lets adjacency do the binding.
   */
  inline?: boolean;
}) => (
  <div className={cn('flex min-w-0', inline ? 'items-baseline gap-1.5' : 'flex-col gap-1')}>
    <span
      className={cn(
        'text-[12px] font-normal',
        inline && 'shrink-0 whitespace-nowrap',
        textColors.tertiary,
      )}
    >
      {label}
    </span>
    <span className={cn('min-w-0 truncate text-[12px] font-semibold leading-[1.3]', textColors.secondary)}>
      {value}
    </span>
  </div>
);
