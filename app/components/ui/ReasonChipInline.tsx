import { StatusInfoIcon } from '@/app/components/ui/icons';
import { Tooltip } from '@/app/components/ui/Tooltip';
import { cn, idcStyles, textColors } from '@/lib/theme';

interface ReasonChipInlineProps {
  /** Full reason text — shown inside the tooltip popover. */
  reason: string;
  /** Short summary text inside the chip (≤ DEFAULT_SUMMARY_LIMIT chars). Derives from reason when omitted. */
  summary?: string;
  /** Secondary line inside the tooltip — typically the registrant and date as a single pre-formatted string. */
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
      <span className={idcStyles.reasonChip.base}>
        <StatusInfoIcon className={cn('h-3 w-3', idcStyles.reasonChip.icon)} />
        <span className={idcStyles.reasonChip.text}>{displaySummary}</span>
      </span>
    </Tooltip>
  );
};
