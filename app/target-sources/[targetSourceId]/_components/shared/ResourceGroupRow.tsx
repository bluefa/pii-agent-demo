'use client';

import type { ReactNode } from 'react';
import { ResourceKindTag } from '@/app/components/ui/RdsInstanceChips';
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
  /** Third identity line — see `ResourceGroupCount` for what it says and why it sits there. */
  inlineMeta?: ReactNode;
  /** This row's share of the group's tree rail (`useRailHover`), tagged with the group's key. */
  rail?: RailRowProps;
  /**
   * How many columns the identity spans — every column after `leadingCell`.
   *
   * The parent used to be a real row with one `<td>` per column, and every one of them ended up
   * empty: Database Type and Region are the pair the group is KEYED on, so the identity says
   * both and filling the columns printed each twice; 설치 구분 is a per-resource verdict a group
   * never received; and the aggregate moved onto the identity to sit beside the region it counts
   * within. A row of blanks that also squeezed the identity into one narrow column — the region
   * chip wrapped to three lines — is not a row, so the identity takes the width instead.
   *
   * NOTE: both tables zero `py-5` for spanning cells (`[&_td:not([colspan])]`), so this one
   * restates its own vertical padding to keep the group row on the list's rhythm.
   */
  colSpan: number;
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
  rail,
  colSpan,
}: ResourceGroupRowProps) => {
  const label = getDatabaseShortLabel(type);
  return (
    <tr
      className={cn(idcStyles.table.group.row, 'cursor-pointer', rail?.className)}
      onClick={onToggle}
      onMouseEnter={rail?.onMouseEnter}
      onMouseLeave={rail?.onMouseLeave}
    >
      {leadingCell}
      <td
        colSpan={colSpan}
        className={cn(
          idcStyles.table.approvalCell,
          'py-5',
          idcStyles.table.nameCell,
          expanded && idcStyles.table.group.parentCell,
        )}
      >
        {/* Three tiers, one per channel — the same stack the RDS cluster row two rows down
            already uses (kind tag → name → detail), so the two foldable rows on this screen
            read alike.

            On one line these three were three greys at three sizes and no rank (owner,
            2026-08-12): a filled grey chip made the REGION shout over the label that owns it,
            and the 14px count sat level with the 14px label. Split across tiers each one gets
            a different channel instead of a different size — surface for the kind, the name
            voice for the region, the quiet meta tone for the counts.

            The region is the NAME here, not an attribute: one Athena catalog per region is
            exactly what a group is, so the region is what tells two groups apart. The type is
            the kind tag, which is what `resourceKind` is for — and it is the same tag `RDS
            Cluster` and `EC2` wear, which is the point.

            The chevron hangs off this box (`toggle` is absolute against it) and centres on the
            stack's middle line, which is the name — same as the cluster row. */}
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
          <span className="flex w-full min-w-0 flex-col items-start gap-1">
            <ResourceKindTag>{label}</ResourceKindTag>
            <span className={idcStyles.table.group.label}>{region}</span>
            {inlineMeta}
          </span>
        </span>
      </td>
    </tr>
  );
};

/**
 * What the group holds — the identity's third line, under the region it counts within.
 *
 * The unit is a segment of its own, not a modifier on the first count: "데이터베이스 대상 1 ·
 * 제외 0" read as one noun phrase run into a second, and broke the parallel between the two
 * counts (owner, 2026-08-12). Separated, the line is a subject and two matching facts.
 *
 * Naming the unit at all is the point: "대상 1" on a row labelled Athena left the reader to
 * work out what was counted, and the answer is neither Athena nor the region — it is the
 * databases folded underneath. Grouping is Athena-only (`GROUPED_TYPES`) and an Athena group's
 * children are databases, so the word is a fact about this row rather than a guess.
 *
 * Two numbers, not three: the total was the sum of the two printed beside it.
 */
export const ResourceGroupCount = ({
  targetCount,
  excludedCount,
}: {
  targetCount: number;
  excludedCount: number;
}) => (
  <span className={idcStyles.table.group.meta}>
    데이터베이스 · 대상 <span className={idcStyles.table.group.metaValue}>{targetCount}</span> ·
    제외 <span className={idcStyles.table.group.metaValue}>{excludedCount}</span>
  </span>
);
