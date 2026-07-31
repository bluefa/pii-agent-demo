'use client';

import { memo } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { idcStyles, primaryColors, textColors, cn } from '@/lib/theme';

export interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;
  region: string;
  resourceName: string;
  selected: boolean;
  /** Exclusion reason text from `excluded_resource_infos[].exclusion_reason`. Only meaningful when `selected === false`. */
  exclusionReason?: string;
  /** Optional metadata line shown beneath the reason text in the tooltip — typically registrant and date. */
  exclusionMeta?: string;
  /** Display db-engine source — prefer endpoint_config.db_type over resource_type (e.g. VM rows). */
  displayDbType?: string;
}

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
  /** Custom empty message shown when `resources` is empty. Defaults to the source-level empty copy. */
  emptyMessage?: string;
  /**
   * When true, render the table as v16 `.approval-table-wrap`: borderless and bottom-rounded
   * only, so it joins directly under the toolbar (top-rounded) as one connected card. Defaults
   * to the standalone framed table (rounded-xl + border + shadow).
   */
  connected?: boolean;
}

// v16 `.approval-table-wrap` (CSS ~2846): border:0; overflow:hidden; background:#fff — joins flush
// under the top-rounded toolbar. The bottom radius belongs to the pagination footer stacked below.
const CONNECTED_FRAME = 'overflow-hidden bg-white';

// Row hover, declared here rather than via idcStyles.table.row — that token is shared with six
// other tables, and its #F7F8FA tint measures 1.06:1 against white (invisible). Excluded rows had
// no hover at all: `rowExcluded` REPLACED `row`, and #F9FAFB -> #F7F8FA would be 1.02:1 anyway.
// Each state keeps its own lift so the excluded tint survives hover (1.10:1 each).
// `focus-within` mirrors hover: the row carries a copy button and tooltip triggers, so a keyboard
// user tabbing through gets the same row highlight a mouse user gets.
// The two hover values must never land on the same element: `cn` is a plain join, so two
// `focus-within:bg-*` classes would let CSS order pick the winner. Each branch owns both of its
// state colors; ROW_BASE carries no color at all.
const ROW_BASE = 'group transition-colors duration-150 motion-reduce:transition-none';
const ROW_TARGET = 'hover:bg-[#F2F4F6] focus-within:bg-[#F2F4F6]';
const ROW_EXCLUDED = 'bg-[#F9FAFB] hover:bg-[#ECEFF3] focus-within:bg-[#ECEFF3]';

// Background alone marks position; it does not make a row easier to READ. Each column lifts on
// whichever axis still has headroom:
//
//   secondary columns  color  #4E5968 -> #191F28 (6.45:1 -> 15.0:1)
//   Resource Name      color  #191F28 -> the primary hover blue, marking the row's anchor
//
// Weight was tried on the name (400 -> 600, safe from reflow because Geist Mono's advance width is
// weight-invariant) and removed: color plus weight on the one blue cell in the row read as shouting.
// One axis per column is the rule; the name already gets the loudest one.
// Dimming the OTHER rows was rejected: #4E5968 at opacity .75 is 4.0:1, under WCAG AA, and it
// would apply to most of the screen the whole time the pointer is in the table.
//
// Declared per cell: `cn` is a plain join, so a group-hover value must sit on the element that
// owns the resting value, not be layered over it from the row.
const CELL_LIFT = 'group-hover:text-[#191F28] group-focus-within:text-[#191F28]';
// The DARK primary, not #0064FF — see primaryColors.textGroupHover for why (contrast under the
// row's hover background). Lighter is not available: #0064FF is already below AA there.
const NAME_LIFT = primaryColors.textGroupHover;

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

// No status dot: the label already says 대상 / 제외, so the dot repeats it in a weaker channel.
const TargetPill = ({ excluded }: { excluded: boolean }) => {
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      {excluded ? '제외' : '대상'}
    </span>
  );
};

// The chip's own 40-char default overruns this six-column table and forces horizontal
// scroll (Azure step 3 reasons run past it). Clamp here — the full text is in the hover tip.
const SUMMARY_LIMIT = 15;

const clampReason = (reason: string): string =>
  reason.length <= SUMMARY_LIMIT ? reason : reason.slice(0, SUMMARY_LIMIT).trimEnd() + '…';

// Blank when there is no reason — target rows can never have one, so an em-dash is noise.
const ReasonCell = ({ resource }: { resource: WaitingApprovalResource }) =>
  !resource.selected && resource.exclusionReason ? (
    <ReasonChipInline
      reason={resource.exclusionReason}
      summary={clampReason(resource.exclusionReason)}
      meta={resource.exclusionMeta}
    />
  ) : null;

export const WaitingApprovalTable = memo(
  ({ resources, emptyMessage, connected = false }: WaitingApprovalTableProps) => {
    if (resources.length === 0) {
      return (
        <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
          {emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </div>
      );
    }

    const monoCell = cn('whitespace-nowrap font-mono text-[12px]', textColors.secondary);

    return (
      <div className={connected ? CONNECTED_FRAME : idcStyles.table.frame}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={idcStyles.table.approvalHeader}>
              {/* Identity (name → id) → attributes (type · region) → decision (verdict → reason).
                  The scan anchor is the human-readable name, not a 3-value category column. */}
              <tr className="whitespace-nowrap">
                <th className={idcStyles.table.approvalHeaderCell}>Resource Name</th>
                <th className={idcStyles.table.approvalHeaderCell}>Resource ID</th>
                <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                {/* The header asks the question, the cell answers it. */}
                <th className={idcStyles.table.approvalHeaderCell}>요청 대상 여부</th>
                <th className={idcStyles.table.approvalHeaderCell}>제외 사유</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {resources.map((resource) => {
                const excluded = !resource.selected;
                return (
                  <tr
                    key={resource.resourceId}
                    className={cn(ROW_BASE, excluded ? ROW_EXCLUDED : ROW_TARGET)}
                  >
                    {/* One line, always. Wrapping turned the row's darkest column into a 2–3 line
                        block and left row heights ragged (59/69/75px); the full name is in the tip. */}
                    <td
                      className={cn(
                        idcStyles.table.approvalCell,
                        'font-mono text-[14px]',
                        textColors.primary,
                        NAME_LIFT,
                      )}
                    >
                      <Tooltip
                        content={
                          <IdentifierTip label="Resource Name" value={resource.resourceName} />
                        }
                        variant="value"
                        size="md"
                        triggerClassName="min-w-0 max-w-[200px] block"
                        truncatedOnly
                      >
                        <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
                      </Tooltip>
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      {/* 260px (the cell default) plus a non-wrapping Region overran the card. */}
                      <ResourceIdCell
                        value={resource.resourceId}
                        label="Resource ID"
                        maxWidthClass="max-w-[220px]"
                        textClassName={CELL_LIFT}
                      />
                    </td>
                    {/* DB Type is a repeating attribute, not a status — one badge per row (the
                        verdict) is enough; a second pill would compete with it. */}
                    <td className={cn(idcStyles.table.approvalCell, 'text-[12px]', textColors.secondary, CELL_LIFT)}>
                      {getDatabaseShortLabel(resource.displayDbType ?? resource.resourceType)}
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, monoCell, CELL_LIFT)}>
                      {resource.region || PLACEHOLDER}
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <TargetPill excluded={excluded} />
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                      <ReasonCell resource={resource} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

WaitingApprovalTable.displayName = 'WaitingApprovalTable';
