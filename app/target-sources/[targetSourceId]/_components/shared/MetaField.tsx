import { cn, textColors } from '@/lib/theme';

/**
 * One card-header meta pair (요청일시 / 승인자 …) — label over value, both 12px.
 * Only weight and color separate the tiers, so the pair still clears 4.5:1.
 * Deliberately not `identityBarStyles` (13px, near-black): that tier belongs to the
 * page-level identity bar, and this one sits below the 16px guidance copy.
 */
export const MetaField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className={cn('text-[12px] font-normal', textColors.tertiary)}>{label}</span>
    <span className={cn('min-w-0 truncate text-[12px] font-semibold leading-[1.3]', textColors.secondary)}>
      {value}
    </span>
  </div>
);
