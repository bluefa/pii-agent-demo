'use client';

import { cn, idcStyles, numericFeatures, textColors } from '@/lib/theme';

/**
 * A logical-DB count (step 6). Non-zero opens the read-only list, so it renders as the
 * underlined text action the app uses for in-context links — a filled button per row would
 * turn the table into a toolbar. Zero has nothing to open, so it stays plain text rather
 * than a link that answers with an empty panel; a missing summary row renders —.
 *
 * Shared by the cloud (WaitingApprovalTable) and IDC (IdcResourceTable) step-6 tables.
 */
export const LogicalDbCountCell = ({
  count,
  tone,
  label,
  onOpen,
}: {
  count: number | null | undefined;
  tone: 'included' | 'excluded';
  label: string;
  onOpen?: () => void;
}) => {
  if (count == null) return <span className={textColors.quaternary}>—</span>;
  if (count === 0) {
    return (
      <span className={cn('text-[13px] font-medium', numericFeatures.tabular, textColors.quaternary)}>
        0<span className="ml-px text-[12px]">개</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(
        tone === 'excluded' ? idcStyles.triggerBtn.linkWarn : idcStyles.triggerBtn.linkPrimary,
        numericFeatures.tabular,
      )}
    >
      {count}
      <span className="text-[12px] font-medium">개</span>
    </button>
  );
};
