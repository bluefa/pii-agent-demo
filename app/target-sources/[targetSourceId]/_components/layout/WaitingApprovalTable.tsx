'use client';

import { Fragment, memo, useMemo, useState } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { TableEmptyState } from '@/app/target-sources/[targetSourceId]/_components/shared/TableEmptyState';
import {
  ResourceGroupCount,
  ResourceGroupRow,
} from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceGroupRow';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
import { GROUPED_CHILD_KIND_LABEL, groupResourceRows } from '@/lib/resource-grouping';
import {
  INSTALL_STATUS_LABEL,
  type InstallStepCell,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import { idcStyles, primaryColors, statusColors, textColors, cn } from '@/lib/theme';

export interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;
  region: string;
  resourceName: string;
  selected: boolean;
  /** Exclusion reason text from `excluded_resource_infos[].exclusion_reason`. Only meaningful when `selected === false`. */
  exclusionReason?: string;
  /** `integration_category` — separates the scan's ineligible verdict from a user's exclusion. */
  integrationCategory?: string;
  /** `recommend_fail_reason` — why the scan judged it ineligible; absent for AWS/IDC. */
  recommendFailReason?: string;
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
  /**
   * `install` variant only — the selected install step's state for this resource. The step nav
   * picks which cell lands here, so the same row renders a different status per step.
   */
  installCell?: InstallStepCell;
  /**
   * Stable React key, never rendered. A consumer whose rows carry an identifier it must
   * NOT display (IDC's `resource_id` is an internal NLB key — design-spec §8) would
   * otherwise fall back to the list index, which makes per-row Tooltip and copy state
   * follow a slot rather than a resource as the list filters and pages.
   */
  rowKey?: string;
}

/**
 * `approval` (steps 2·3): verdict + exclusion reason as the last two columns.
 * `confirmed` (step 6): every row is a confirmed target, so the verdict pair is replaced by
 * the Step 5 logical-DB counts — what the user actually reviews before the final approval.
 * `install` (step 4): every row is a confirmed target too, so the pair becomes the per-step
 * install status and its contract guidance — the same last-two-columns slot, install vocabulary.
 */
type WaitingApprovalTableVariant = 'approval' | 'confirmed' | 'install';

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
  /**
   * Header for the location column. Defaults to Region; a consumer whose rows can be
   * host-based (an IDC endpoint has no region) passes 위치, since the cell then carries
   * `host:port`.
   */
  regionLabel?: string;
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
export const DIM_TEXT = 'text-[#6B7280]';

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

// No status dot: the label already says 대상 / 제외, so the dot repeats it in a weaker channel.
//
// Ineligible is its own verdict, not a flavour of excluded. The two answer different
// questions: excluded means a person chose to leave the resource out and can put it back by
// re-selecting, while ineligible means the scan found it unreachable and no amount of
// re-selecting changes that. Step 1 already draws that line (the row's checkbox is disabled
// there); collapsing it back into excluded made a system verdict look revisable.
//
// Exported for the IDC steps 2·3 table, which asks the same question in the same column.
// `ineligible` is optional so that caller keeps its current two-state behaviour.
export const TargetPill = ({
  excluded,
  ineligible = false,
}: {
  excluded: boolean;
  ineligible?: boolean;
}) => {
  if (ineligible) {
    // Step 1's grammar for the same fact: warning-dark + a warning glyph, not a pill. A pill
    // would put it in the same visual class as the two revisable verdicts, when this one is
    // the scan saying the resource cannot be reached at all. No underline and no button:
    // step 1 links to the guidance modal because that is where you act, and by this step
    // there is nothing left to act on.
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold',
          statusColors.warning.textDark,
        )}
      >
        <StatusWarningIcon className="h-3.5 w-3.5" />
        연동 불가
      </span>
    );
  }
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      {excluded ? '제외' : '대상'}
    </span>
  );
};

// 상태는 태그가 아니라 글자다 — 행마다 반복되는 값이라 채운 배지를 두면 색이 먼저
// 읽힌다. 색은 "아직 손댈 일이 남았는가"만 말한다: 끝난 것과 해당 없는 것은 회색.
const INSTALL_STATUS_TEXT: Record<InstallStepValue, string> = {
  COMPLETED: textColors.tertiary,
  IN_PROGRESS: statusColors.info.textDark,
  FAIL: statusColors.error.textDark,
  BDC_INSTALL_REQUIRED: statusColors.warning.textDark,
  SKIP: textColors.tertiary,
  UNKNOWN: textColors.tertiary,
};

const InstallStatusText = ({ cell }: { cell: InstallStepCell }) => (
  <span className={cn('whitespace-nowrap font-semibold', INSTALL_STATUS_TEXT[cell.status])}>
    {cell.label ?? INSTALL_STATUS_LABEL[cell.status]}
  </span>
);

// The chip's own 40-char default overruns this six-column table and forces horizontal
// scroll (Azure step 3 reasons run past it). Clamp here — the full text is in the hover tip.
const SUMMARY_LIMIT = 15;

export const clampReason = (reason: string): string =>
  reason.length <= SUMMARY_LIMIT ? reason : reason.slice(0, SUMMARY_LIMIT).trimEnd() + '…';

// Blank when there is no reason — target rows can never have one, so an em-dash is noise.
//
// For an install-ineligible row the scan's own verdict stands in: `exclusion_reason` already
// carries it (the request adapter writes it there), but older requests predate that and only
// have `recommend_fail_reason`, so read both. The enum is shown verbatim — its three values
// name specific network conditions (a public IP, an internal-LB subnet, a failed private
// endpoint) and there is no documented Korean wording for them, so translating would mean
// inventing guidance about infrastructure the user is expected to go fix.
const ReasonCell = ({ resource }: { resource: WaitingApprovalResource }) => {
  if (resource.selected) return null;
  const reason = resource.exclusionReason || resource.recommendFailReason;
  if (!reason) return null;
  return (
    <ReasonChipInline
      reason={reason}
      summary={clampReason(reason)}
      meta={resource.exclusionMeta}
    />
  );
};

export const WaitingApprovalTable = memo(
  ({
    resources,
    variant = 'approval',
    onLogicalDbOpen,
    emptyMessage,
    connected = false,
    regionLabel = 'Region',
  }: WaitingApprovalTableProps) => {
    // Athena arrives as many rows of one catalog family per region; grouping restores the
    // parent it belongs to (LIN-85). Groups start OPEN — the approval table is the "review
    // everything before you approve" surface, so nothing may be hidden by default.
    //
    // ONLY the `approval` variant groups. From step 4 on the region IS the resource — step 4
    // (`install`) already receives one Athena row per region, keyed on
    // `athena_region_resource_id`, and step 5 folds onto the same key; steps 6·7 (`confirmed`)
    // still list databases but a parent-with-children tree would assert a shape they do not
    // have, and Athena has no logical-DB or credential column to aggregate anyway (it is
    // IAM-based). Written as an allow-list, not `!== 'confirmed'`: that phrasing opted the
    // install variant in the moment it was added, and drew a second Region cell on step 4.
    const grouped = variant === 'approval';
    const sections = useMemo(
      () =>
        grouped
          ? groupResourceRows(resources, (resource) => ({
              type: resource.resourceType,
              region: resource.region,
              selected: resource.selected,
            }))
          : [{ kind: 'rows' as const, key: 'rows-0', rows: resources }],
      [resources, grouped],
    );
    const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(() => new Set());

    const toggleGroup = (key: string) =>
      setCollapsedGroups((previous) => {
        const next = new Set(previous);
        if (!next.delete(key)) next.add(key);
        return next;
      });

    if (resources.length === 0) {
      return <TableEmptyState message={emptyMessage ?? DEFAULT_EMPTY_MESSAGE} />;
    }

    const confirmedVariant = variant === 'confirmed';
    const installVariant = variant === 'install';

    // Colorless — each row picks its resting tier (dim vs secondary) at the cell.
    const monoCell = 'whitespace-nowrap font-mono text-[12px]';

    // `grouped` only indents the identity cell — every other cell is identical whether the row
    // stands alone or hangs under a parent, so a group never changes what a row says.
    const renderRow = (resource: WaitingApprovalResource, grouped = false, lastInGroup = false) => {
      const excluded = !resource.selected;
      return (
        <tr
          // `resource_id` is optional in the contract, so two id-less rows would collide on
          // one '' key and React would drop a row. `rowKey` is for consumers that HAVE an
          // identity they may not render (IDC's internal NLB key — design-spec §8).
          key={resource.rowKey || resource.resourceId || resource.resourceName}
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
              grouped && idcStyles.table.group.childCell,
              grouped && lastInGroup && idcStyles.table.group.childCellLast,
            )}
          >
            <Tooltip
              content={<IdentifierTip label="Resource Name" value={resource.resourceName} />}
              variant="value"
              size="md"
              triggerClassName="min-w-0 max-w-[200px] block"
              truncatedOnly
            >
              <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
            </Tooltip>
          </td>
          {/* Inside a group the id is dropped: it is the parent's own path with the child's name
              tacked on (`athena:<acct>:<region>/<catalog>/test_raw`), so every child repeated the
              group's identity and then said its name a second time. */}
          <td className={idcStyles.table.approvalCell}>
            {grouped ? null : (
              // 260px (the cell default) plus a non-wrapping Region overran the card.
              <ResourceIdCell
                value={resource.resourceId}
                label="Resource ID"
                maxWidthClass="max-w-[220px]"
                textClassName={cn(excluded ? DIM_TEXT : textColors.secondary, CELL_LIFT)}
              />
            )}
          </td>
          {/* DB Type is a repeating attribute, not a status — one badge per row (the
              verdict) is enough; a second pill would compete with it.
              Inside a group this column carries what the row IS: the parent says `Athena`,
              each child says `Database`. Region belongs to the parent alone. */}
          {!installVariant && (
            <>
              <td
                className={cn(
                  idcStyles.table.approvalCell,
                  'text-[12px]',
                  excluded ? DIM_TEXT : textColors.secondary,
                  CELL_LIFT,
                )}
              >
                {grouped
                  ? GROUPED_CHILD_KIND_LABEL
                  : getDatabaseShortLabel(resource.displayDbType ?? resource.resourceType)}
              </td>
              <td
                className={cn(
                  idcStyles.table.approvalCell,
                  monoCell,
                  excluded ? DIM_TEXT : textColors.secondary,
                  CELL_LIFT,
                )}
              >
                {grouped ? null : resource.region || PLACEHOLDER}
              </td>
            </>
          )}
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
          ) : installVariant ? (
            <>
              <td className={idcStyles.table.approvalCell}>
                {resource.installCell && <InstallStatusText cell={resource.installCell} />}
              </td>
              {/* 안내 없음은 빈 칸 — 대시는 시각적 노이즈만 남긴다. */}
              <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                {resource.installCell?.guide ? (
                  <ReasonChipInline
                    reason={resource.installCell.guide}
                    summary={clampReason(resource.installCell.guide)}
                    label="안내"
                  />
                ) : null}
              </td>
            </>
          ) : (
            <>
              <td className={idcStyles.table.approvalCell}>
                <TargetPill
                  excluded={excluded}
                  ineligible={resource.integrationCategory === 'INSTALL_INELIGIBLE'}
                />
              </td>
              <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                <ReasonCell resource={resource} />
              </td>
            </>
          )}
        </tr>
      );
    };

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
                {/* Step 4 drops the two attribute columns: the engine was settled back on
                    steps 1·2 and the install runs the same either way, and the region is a
                    constant within one target source (and already inside the resource id).
                    What they cost — 250px — is what 상태/안내 need to stay on screen. */}
                {!installVariant && (
                  <>
                    <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                    <th className={idcStyles.table.approvalHeaderCell}>{regionLabel}</th>
                  </>
                )}
                {confirmedVariant ? (
                  <>
                    <th className={idcStyles.table.approvalHeaderCell}>연동 논리 DB</th>
                    <th className={idcStyles.table.approvalHeaderCell}>연동 제외</th>
                  </>
                ) : installVariant ? (
                  <>
                    <th className={idcStyles.table.approvalHeaderCell}>상태</th>
                    <th className={idcStyles.table.approvalHeaderCell}>안내</th>
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
            {sections.map((section) => {
              if (section.kind === 'rows') {
                return (
                  <tbody key={section.key} className={idcStyles.table.body}>
                    {section.rows.map((resource) => renderRow(resource))}
                  </tbody>
                );
              }

              const { group } = section;
              const rowsId = `approval-group-${group.key.replace('|', '-')}`;
              const collapsed = collapsedGroups.has(group.key);
              return (
                <Fragment key={group.key}>
                  <tbody className={idcStyles.table.body}>
                    <ResourceGroupRow
                      type={group.type}
                      region={group.region}
                      expanded={!collapsed}
                      onToggle={() => toggleGroup(group.key)}
                      controls={rowsId}
                    >
                      {/* Resource ID stays blank: the catalog id lives only inside each child's
                          resource_id string, which we do not parse. Database Type and Region are
                          the pair the group is keyed on, so they are the parent's own values and
                          the children below leave those two cells empty. */}
                      <td className={idcStyles.table.approvalCell} />
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          'text-[12px]',
                          textColors.secondary,
                        )}
                      >
                        {getDatabaseShortLabel(group.type)}
                      </td>
                      <td
                        className={cn(idcStyles.table.approvalCell, monoCell, textColors.secondary)}
                      >
                        {group.region}
                      </td>
                      {/* Only the approval variant reaches here, so the aggregate always lands
                          in the verdict column — the question that column asks. */}
                      <td className={idcStyles.table.approvalCell}>
                        <ResourceGroupCount
                          targetCount={group.targetCount}
                          excludedCount={group.excludedCount}
                        />
                      </td>
                      <td className={idcStyles.table.approvalCell} />
                    </ResourceGroupRow>
                  </tbody>
                  {/* Kept mounted while collapsed so `aria-controls` always resolves. */}
                  <tbody id={rowsId} hidden={collapsed} className={idcStyles.table.body}>
                    {group.rows.map((resource, index) =>
                      renderRow(resource, true, index === group.rows.length - 1),
                    )}
                  </tbody>
                </Fragment>
              );
            })}
          </table>
        </div>
      </div>
    );
  },
);

WaitingApprovalTable.displayName = 'WaitingApprovalTable';
