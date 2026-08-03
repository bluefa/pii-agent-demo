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
  /** Aggregate rendered beside the identity, for tables with no spare column to put it in. */
  inlineMeta?: ReactNode;
  /**
   * The parent's remaining `<td>`s, one per column after the identity cell. The parent is a real
   * row, not a colspan band (시안 §04), so the caller decides which columns carry the aggregate —
   * Step 1 answers in 설치 구분, the approval table answers in 요청 대상 여부.
   *
   * Database Type and Region belong here, filled with the group's own values: the group is keyed
   * on exactly that pair, so they are its attributes, and the children inherit rather than repeat
   * them. A parent left blank across four columns read as a broken row, not as a summary.
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
  inlineMeta,
  children,
}: ResourceGroupRowProps) => {
  const label = getDatabaseShortLabel(type);

  return (
    <tr className={cn(idcStyles.table.group.row, 'cursor-pointer')} onClick={onToggle}>
      {leadingCell}
      <td
        className={cn(
          idcStyles.table.approvalCell,
          expanded && idcStyles.table.group.parentCell,
        )}
      >
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
              expanded ? idcStyles.table.group.toggleOpen : idcStyles.table.group.toggleClosed,
              primaryColors.focusRing,
            )}
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
          <span className={idcStyles.table.group.label}>{label}</span>
          {inlineMeta}
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
