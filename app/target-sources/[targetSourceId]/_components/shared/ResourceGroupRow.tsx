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
  /** Aggregate rendered beside the identity — see `ResourceGroupCount` for why it lives there. */
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
        {/* One line: type · region · counts. The chevron hangs off this box (`toggle` is
            absolute against it), so it stays centred on the line it opens. */}
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
          {/* The region rides the label instead of holding a column of its own (owner,
              2026-08-12). The group is keyed on the (type, region) PAIR, so the two are one
              identity — split across the row they read as two independent facts, and the Region
              column then repeated for the parent what the children below leave blank anyway.
              A neutral chip, not the violet `resourceKind` tier: that tier answers "what this
              row IS", and where it runs is a different question. */}
          <Badge variant="neutral" size="sm" className="whitespace-nowrap font-mono">
            {region}
          </Badge>
          {inlineMeta}
        </span>
      </td>
    </tr>
  );
};

/**
 * What the group holds, said beside the identity it counts within (owner, 2026-08-12).
 *
 * It names its UNIT first. "1 대상 · 0 제외" left the reader to work out what was being counted
 * from a row whose own label says Athena — and the answer is neither Athena nor the region, it
 * is the databases folded underneath. Grouping is Athena-only (`GROUPED_TYPES`), and an Athena
 * group's children are databases, so the word is a fact about this row rather than a guess.
 *
 * Two numbers, not three: the total was the sum of the two printed beside it, so it never said
 * anything the same line did not.
 */
export const ResourceGroupCount = ({
  targetCount,
  excludedCount,
}: {
  targetCount: number;
  excludedCount: number;
}) => (
  <span className={idcStyles.table.group.meta}>
    데이터베이스 대상 <span className={idcStyles.table.group.metaValue}>{targetCount}</span> ·
    제외 <span className={idcStyles.table.group.metaValue}>{excludedCount}</span>
  </span>
);
