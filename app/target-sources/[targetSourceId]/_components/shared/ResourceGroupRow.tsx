'use client';

import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { cn, idcStyles, primaryColors } from '@/lib/theme';

interface ResourceGroupRowProps {
  /** Resource type the group is keyed on — rendered through the shared short label (`ATHENA` → "Athena"). */
  type: string;
  region: string;
  expanded: boolean;
  onToggle: () => void;
  /** Id of the element the chevron controls, so screen readers follow the parent/child pair. */
  controls: string;
  /** Leading spacer cell — pass the checkbox column's `<td>` when the table has one. */
  leadingCell?: ReactNode;
  /**
   * The parent's remaining `<td>`s, one per column after the identity cell. The parent is a real
   * row, not a colspan band (시안 §04), so the caller decides which columns carry the aggregate —
   * Step 1 answers in 설치 구분, the approval table answers in 요청 대상 여부.
   */
  children: ReactNode;
}

/**
 * Parent row of a grouped resource table (Athena × Region).
 *
 * The whole row toggles; the chevron is the labelled control so a keyboard user gets one stop per
 * group instead of one per cell. Counts belong in the caller's aggregate cells — collapsing a group
 * must never hide how many targets it holds, which is the reason the grouping exists at all.
 */
export const ResourceGroupRow = ({
  type,
  region,
  expanded,
  onToggle,
  controls,
  leadingCell,
  children,
}: ResourceGroupRowProps) => {
  const label = getDatabaseShortLabel(type);

  return (
    <tr className={cn(idcStyles.table.group.row, 'cursor-pointer')} onClick={onToggle}>
      {leadingCell}
      <td className={idcStyles.table.approvalCell}>
        <span className={idcStyles.table.group.lead}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={controls}
            aria-label={`${label} ${region} 그룹 ${expanded ? '접기' : '펼치기'}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className={cn(
              idcStyles.table.group.toggle,
              expanded && idcStyles.table.group.toggleOpen,
              primaryColors.focusRing,
            )}
          >
            <ChevronRightIcon className="h-3 w-3" />
          </button>
          <span className={idcStyles.table.group.label}>{label}</span>
          <span className={idcStyles.table.group.chip}>{region}</span>
        </span>
      </td>
      {children}
    </tr>
  );
};

/** Aggregate summary shown in one of the parent row's own columns. */
export const ResourceGroupCount = ({
  targetCount,
  excludedCount,
}: {
  targetCount: number;
  excludedCount: number;
}) => (
  <span className={idcStyles.table.group.meta}>
    {`${targetCount} 대상 · ${excludedCount} 제외 · 총 ${targetCount + excludedCount}`}
  </span>
);
