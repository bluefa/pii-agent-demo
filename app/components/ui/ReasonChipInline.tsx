import { StatusInfoIcon } from '@/app/components/ui/icons';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

interface ReasonChipInlineProps {
  /** Full reason text — shown inside the tooltip popover. */
  reason: string;
  /** Short summary text inside the chip (≤ DEFAULT_SUMMARY_LIMIT chars). Derives from reason when omitted. */
  summary?: string;
  /** Secondary line inside the tooltip, e.g. "등록자: 홍길동 · 2026-05-08". */
  meta?: string;
}

const DEFAULT_SUMMARY_LIMIT = 40;

const deriveSummary = (reason: string): string => {
  if (reason.length <= DEFAULT_SUMMARY_LIMIT) return reason;
  return reason.slice(0, DEFAULT_SUMMARY_LIMIT).trimEnd() + '…';
};

export const ReasonChipInline = ({ reason, summary, meta }: ReasonChipInlineProps) => {
  const displaySummary = summary ?? deriveSummary(reason);
  return (
    <Tooltip
      size="md"
      content={
        <div className="space-y-1">
          <div className="text-[12.5px] leading-[1.5]">{reason}</div>
          {meta && <div className={cn('text-[11px]', textColors.tertiary)}>{meta}</div>}
        </div>
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium cursor-default',
          borderColors.default,
          bgColors.muted,
          textColors.secondary,
        )}
      >
        <StatusInfoIcon className={cn('h-3 w-3', textColors.quaternary)} />
        <span className="truncate max-w-[200px]">{displaySummary}</span>
      </span>
    </Tooltip>
  );
};
