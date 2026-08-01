'use client';

import { memo } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { TableEmptyState } from '@/app/target-sources/[targetSourceId]/_components/shared/TableEmptyState';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
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
  /**
   * `confirmed` variant only — Step 5 connection-test counts (latest-results). `null` when the
   * resource has no summary row; the cell renders — rather than a fabricated 0.
   */
  logicalDbCount?: number | null;
  excludedLogicalDbCount?: number | null;
}

/**
 * `approval` (steps 2·3): verdict + exclusion reason as the last two columns.
 * `confirmed` (step 6): every row is a confirmed target, so the verdict pair is replaced by
 * the Step 5 logical-DB counts — what the user actually reviews before the final approval.
 */
type WaitingApprovalTableVariant = 'approval' | 'confirmed';

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
  variant?: WaitingApprovalTableVariant;
  /** `confirmed` variant — open the read-only logical-DB list for one resource. */
  onLogicalDbOpen?: (resource: WaitingApprovalResource) => void;
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
export const CONNECTED_FRAME = 'overflow-hidden bg-white';

// Row hover, declared here rather than via idcStyles.table.row — that token is shared with six
// other tables, and its #F7F8FA tint measures 1.06:1 against white (invisible). Excluded rows had
// no hover at all: `rowExcluded` REPLACED `row`, and #F9FAFB -> #F7F8FA would be 1.02:1 anyway.
// Each state keeps its own lift so the excluded tint survives hover (1.10:1 each).
// `focus-within` mirrors hover: the row carries a copy button and tooltip triggers, so a keyboard
// user tabbing through gets the same row highlight a mouse user gets.
// The two hover values must never land on the same element: `cn` is a plain join, so two
// `focus-within:bg-*` classes would let CSS order pick the winner. Each branch owns both of its
// state colors; ROW_BASE carries no color at all.
// The tints lean blue rather than neutral. On hover the Resource Name turns brand blue, and over a
// neutral gray that one cell reads as the only thing that changed; a faintly blue row reads as one
// active object. Depth is the same as the neutral palette step #EBEEF2 would have given (1.16:1 vs
// white) — the extra value buys hue, not darkness, and costs almost nothing in text contrast
// (#0050D6 5.79:1, #191F28 14.25:1).
// Chroma stays deliberately low: this family sits at the SAME luminance as the primary tint
// #E8F1FF (1.01:1 apart), so saturation is the only thing separating "hovered" from "primary".
// A future `selected` state must therefore not be a blue tint — hover already owns that.
export const ROW_BASE = 'group transition-colors duration-150 motion-reduce:transition-none';
export const ROW_TARGET = 'hover:bg-[#EAEEF7] focus-within:bg-[#EAEEF7]';
export const ROW_EXCLUDED = 'bg-[#F9FAFB] hover:bg-[#E3E8F2] focus-within:bg-[#E3E8F2]';

// Background alone marks position; it does not make a row easier to READ. Each column lifts on
// whichever axis still has headroom:
//
//   secondary columns  color  #4E5968 -> #191F28 (6.12:1 -> 14.25:1 on the hover tint)
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
export const CELL_LIFT = 'group-hover:text-[#191F28] group-focus-within:text-[#191F28]';
// The DARK primary, not #0064FF — see primaryColors.textGroupHover for why (contrast under the
// row's hover background). Lighter is not available: #0064FF is already below AA there.
const NAME_LIFT = primaryColors.textGroupHover;

// Excluded rows REST one tier dimmer: all four text cells drop to #6B7280 — 4.63:1 on the
// #F9FAFB tint, AA with margin, where the full-strength text made 제외 rows read identical to
// 대상 rows (the 1.05:1 background tint carries nothing). The hover/focus lifts above restore
// full contrast the moment the row is engaged, so the dim tier is never the reading surface.
// Chips and the reason chip keep full contrast: the verdict and the why must survive the fade.
// 3:1-grade dimming (#8B95A1, 2.9:1) was considered and rejected — 13px body text is normal-size
// text under WCAG, and the reason column is content, not an inactive control.
const DIM_TEXT = 'text-[#6B7280]';

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

// No status dot: the label already says 대상 / 제외, so the dot repeats it in a weaker channel.
// Exported for the IDC steps 2·3 table, which asks the same question in the same column.
export const TargetPill = ({ excluded }: { excluded: boolean }) => {
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

export const clampReason = (reason: string): string =>
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
  ({
    resources,
    variant = 'approval',
    onLogicalDbOpen,
    emptyMessage,
    connected = false,
  }: WaitingApprovalTableProps) => {
    if (resources.length === 0) {
      return <TableEmptyState message={emptyMessage ?? DEFAULT_EMPTY_MESSAGE} />;
    }

    const confirmedVariant = variant === 'confirmed';

    // Colorless — each row picks its resting tier (dim vs secondary) at the cell.
    const monoCell = 'whitespace-nowrap font-mono text-[12px]';

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
                {confirmedVariant ? (
                  <>
                    <th className={idcStyles.table.approvalHeaderCell}>연동 논리 DB</th>
                    <th className={idcStyles.table.approvalHeaderCell}>연동 제외</th>
                  </>
                ) : (
                  <>
                    {/* The header asks the question, the cell answers it. */}
                    <th className={idcStyles.table.approvalHeaderCell}>요청 대상 여부</th>
                    <th className={idcStyles.table.approvalHeaderCell}>제외 사유</th>
                  </>
                )}
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
                        excluded ? DIM_TEXT : textColors.primary,
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
                        textClassName={cn(excluded ? DIM_TEXT : textColors.secondary, CELL_LIFT)}
                      />
                    </td>
                    {/* DB Type is a repeating attribute, not a status — one badge per row (the
                        verdict) is enough; a second pill would compete with it. */}
                    <td
                      className={cn(
                        idcStyles.table.approvalCell,
                        'text-[12px]',
                        excluded ? DIM_TEXT : textColors.secondary,
                        CELL_LIFT,
                      )}
                    >
                      {getDatabaseShortLabel(resource.displayDbType ?? resource.resourceType)}
                    </td>
                    <td
                      className={cn(
                        idcStyles.table.approvalCell,
                        monoCell,
                        excluded ? DIM_TEXT : textColors.secondary,
                        CELL_LIFT,
                      )}
                    >
                      {resource.region || PLACEHOLDER}
                    </td>
                    {confirmedVariant ? (
                      <>
                        <td className={idcStyles.table.approvalCell}>
                          <LogicalDbCountCell
                            count={resource.logicalDbCount}
                            label={`${resource.resourceName || resource.resourceId} 연동 논리 DB 목록 보기`}
                            onOpen={() => onLogicalDbOpen?.(resource)}
                          />
                        </td>
                        <td className={idcStyles.table.approvalCell}>
                          <LogicalDbCountCell
                            count={resource.excludedLogicalDbCount}
                            label={`${resource.resourceName || resource.resourceId} 연동 제외 대상 보기`}
                            onOpen={() => onLogicalDbOpen?.(resource)}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={idcStyles.table.approvalCell}>
                          <TargetPill excluded={excluded} />
                        </td>
                        <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                          <ReasonCell resource={resource} />
                        </td>
                      </>
                    )}
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
