'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { cn, idcStyles, primaryColors } from '@/lib/theme';
import type { RailRowProps } from '@/app/hooks/useRailHover';

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
   * Second identity line, for what the fold hides — the caller renders it only while collapsed.
   *
   * Folding cuts row COUNT, not information. An Athena group with its databases folded away is
   * a row naming a service and a region, and in steps 1–3 neither is the thing being decided:
   * the decision unit is the database. The row only decides where this goes — under the label,
   * on the column's own left edge, with the chevron still centred on the label line.
   */
  subline?: ReactNode;
  /** This row's share of the group's tree rail (`useRailHover`), tagged with the group's key. */
  rail?: RailRowProps;
  /**
   * The parent's remaining `<td>`s, one per column after the identity cell. The parent is a real
   * row, not a colspan band (시안 §04), so the caller decides which columns carry the aggregate —
   * Step 1 answers in 설치 구분, the approval table answers in 요청 대상 여부.
   *
   * Database Type and Region do NOT belong here any more — the group is keyed on that pair, and
   * the identity cell now says both (the label IS the type, the chip beside it IS the region).
   * Filling the two columns as well printed each of them twice on the one row that has them, next
   * to children that leave both blank. What earns a cell here is what the identity cannot say:
   * the aggregate, and whichever column the screen uses to answer its own question.
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
  subline,
  rail,
  children,
}: ResourceGroupRowProps) => {
  const label = getDatabaseShortLabel(type);
  // The chevron hangs off THIS box (`toggle` is absolute against it), so it stays a single
  // line: centred on the label rather than floating between the label and the subline.
  const lead = (
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
      {/* The region rides the label instead of holding a column of its own (owner, 2026-08-12).
          The group is keyed on the (type, region) PAIR, so the two are one identity — split
          across the row they read as two independent facts, and the Region column then repeated
          for the parent what the children below leave blank anyway. A neutral chip, not the
          violet `resourceKind` tier: that tier answers "what this row IS", and where it runs is
          a different question. */}
      <Badge variant="neutral" size="sm" className="font-mono">
        {region}
      </Badge>
      {inlineMeta}
    </span>
  );

  return (
    <tr
      className={cn(idcStyles.table.group.row, 'cursor-pointer', rail?.className)}
      onClick={onToggle}
      onMouseEnter={rail?.onMouseEnter}
      onMouseLeave={rail?.onMouseLeave}
    >
      {leadingCell}
      <td
        className={cn(
          idcStyles.table.approvalCell,
          idcStyles.table.nameCell,
          expanded && idcStyles.table.group.parentCell,
        )}
      >
        {subline ? (
          // `w-full`, not `items-start`: the subline truncates, and shrink-to-fit children give
          // it nothing to truncate against — it would push the column instead of clipping.
          <span className="flex w-full min-w-0 flex-col gap-1">
            {lead}
            {subline}
          </span>
        ) : (
          lead
        )}
      </td>
      {children}
    </tr>
  );
};

/**
 * Aggregate summary shown in one of the parent row's own columns.
 *
 * Two numbers, not three: the total was the sum of the two beside it, so it never told anyone
 * anything they could not read off the same line, and it made a three-part phrase out of a
 * two-part fact (owner, 2026-08-12).
 */
export const ResourceGroupCount = ({
  targetCount,
  excludedCount,
}: {
  targetCount: number;
  excludedCount: number;
}) => (
  <span className={idcStyles.table.group.meta}>
    <span className={idcStyles.table.group.metaValue}>{targetCount}</span> 대상 ·{' '}
    <span className={idcStyles.table.group.metaValue}>{excludedCount}</span> 제외
  </span>
);
