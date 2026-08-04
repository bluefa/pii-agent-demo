'use client';

import { Fragment, memo, useMemo, useState } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { ChevronRightIcon, StatusWarningIcon } from '@/app/components/ui/icons';
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
import { hasLogicalDatabases } from '@/lib/types';
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
   * `confirmed` variant only — the databases this row stands for when it is a folded Athena
   * region. Present means the row IS the region: the identity cell carries the disclosure and
   * the engine's label instead of a resource name, and opening it lists these underneath.
   * Absent (the normal case) leaves the row exactly as it was.
   *
   * Carries the id, not just the name: `resource_name` is optional in the contract, so two
   * unnamed databases in one region would collide on a '' React key — the same hazard the row
   * key below already guards against.
   */
  foldedMembers?: readonly { resourceId: string; resourceName: string }[];
  /**
   * Extra text the caller's search should match, never rendered. A folded row is named by the
   * engine, so its databases would otherwise become unfindable the moment they are collapsed
   * behind the disclosure.
   */
  searchText?: string;
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
  /**
   * Force every folded region open. Pass this while a search or filter is narrowing the list:
   * a row can match on a database that is collapsed behind the disclosure, and leaving it shut
   * shows the user a region that does not visibly contain what they typed.
   */
  expandFolds?: boolean;
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
export const NAME_LIFT = primaryColors.textGroupHover;

// Excluded rows REST one tier dimmer: all four text cells drop to #6B7280 — 4.63:1 on the
// #F9FAFB tint, AA with margin, where the full-strength text made 제외 rows read identical to
// 대상 rows (the 1.05:1 background tint carries nothing). The hover/focus lifts above restore
// full contrast the moment the row is engaged, so the dim tier is never the reading surface.
// Chips and the reason chip keep full contrast: the verdict and the why must survive the fade.
// 3:1-grade dimming (#8B95A1, 2.9:1) was considered and rejected — 13px body text is normal-size
// text under WCAG, and the reason column is content, not an inactive control.
export const DIM_TEXT = 'text-[#6B7280]';

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

/** 논리 DB 라는 개념이 없는 엔진의 답 — see `hasLogicalDatabases`. */
export const NO_LOGICAL_DB_TEXT = '설정 불필요';

const NoLogicalDbCell = () => (
  <span className={cn('whitespace-nowrap text-[12px]', textColors.tertiary)}>
    {NO_LOGICAL_DB_TEXT}
  </span>
);

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
    expandFolds = false,
  }: WaitingApprovalTableProps) => {
    // Athena arrives as many rows of one catalog family per region; grouping restores the
    // parent it belongs to (LIN-85). Groups start OPEN — the approval table is the "review
    // everything before you approve" surface, so nothing may be hidden by default.
    //
    // ONLY the `approval` variant builds a TREE. From step 4 on the region IS the resource —
    // step 4 (`install`) already receives one Athena row per region keyed on
    // `athena_region_resource_id`, and steps 5·6·7 fold onto that same key, which is a row that
    // STANDS FOR the region rather than a parent above its children (see `foldedMembers`).
    // Written as an allow-list, not `!== 'confirmed'`: that phrasing opted the install variant
    // in the moment it was added, and drew a second Region cell on step 4.
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
    const [expandedFolds, setExpandedFolds] = useState<ReadonlySet<string>>(() => new Set());

    const toggleGroup = (key: string) =>
      setCollapsedGroups((previous) => {
        const next = new Set(previous);
        if (!next.delete(key)) next.add(key);
        return next;
      });

    // Which folded Athena regions are open (steps 6·7). CLOSED by default, the opposite of the
    // approval groups above: there the user is reviewing every database before approving, here
    // the region is the unit and its databases are reference.
    const toggleFold = (key: string) =>
      setExpandedFolds((previous) => {
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
      const rowKey = resource.rowKey || resource.resourceId || resource.resourceName;
      // A folded row STANDS FOR an Athena region (steps 6·7) — see `foldedMembers`.
      const members = resource.foldedMembers;
      const folded = !!members?.length;
      const open = folded && (expandFolds || expandedFolds.has(rowKey));
      const foldLabel = getDatabaseShortLabel(resource.resourceType) || PLACEHOLDER;
      const row = (
        <tr
          // `resource_id` is optional in the contract, so two id-less rows would collide on
          // one '' key and React would drop a row. `rowKey` is for consumers that HAVE an
          // identity they may not render (IDC's internal NLB key — design-spec §8).
          key={rowKey}
          className={cn(ROW_BASE, excluded ? ROW_EXCLUDED : ROW_TARGET, folded && 'cursor-pointer')}
          onClick={folded ? () => toggleFold(rowKey) : undefined}
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
              folded && open && idcStyles.table.group.parentCell,
            )}
          >
            {folded ? (
              // A region has no resource name, so the cell carries the engine's label instead.
              // It reads in the SAME type as every other name in this column, NOT in the group
              // parent's heavier weight above: that weight separates a parent from the children
              // right under it, and here the row's neighbours are ordinary resources.
              <span className={idcStyles.table.group.lead}>
                {expandFolds ? (
                  /* The filter owns the open state while it narrows the list, so this is an
                     indicator, not a control. Left as a live toggle it did nothing visible AND
                     recorded the press as an EXPAND — clearing the filter then left the fold
                     open, the opposite of what was pressed, a step after the press. */
                  <span
                    aria-hidden
                    className={cn(
                      idcStyles.table.group.toggle,
                      idcStyles.table.group.toggleStatic,
                    )}
                  >
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`${foldLabel} ${resource.region} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFold(rowKey);
                    }}
                    className={cn(
                      idcStyles.table.group.toggle,
                      open
                        ? idcStyles.table.group.toggleOpen
                        : idcStyles.table.group.toggleClosed,
                      primaryColors.focusRing,
                    )}
                  >
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* `database_type` is optional in the contract, and an unlabelled row is a bare
                    chevron with nothing beside it. */}
                <span className="whitespace-nowrap">{foldLabel}</span>
              </span>
            ) : (
              <Tooltip
                content={<IdentifierTip label="Resource Name" value={resource.resourceName} />}
                variant="value"
                size="md"
                triggerClassName="min-w-0 max-w-[200px] block"
                truncatedOnly
              >
                <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
              </Tooltip>
            )}
          </td>
          {/* Inside a group the id is dropped: it is the parent's own path with the child's name
              tacked on (`athena:<acct>:<region>/<catalog>/test_raw`), so every child repeated the
              group's identity and then said its name a second time. */}
          {/* A folded row toggles on click, and this cell holds a copy button — without the
              guard, copying the region id also opened the fold. The chevron above stops its
              own propagation for the same reason. */}
          <td
            className={idcStyles.table.approvalCell}
            onClick={folded ? (event) => event.stopPropagation() : undefined}
          >
            {/* An absent id renders nothing rather than a bare control: a consumer that
                withholds it (IDC's resource_id is internal) would otherwise get a
                focusable "Resource ID 복사" on every row, copying ''. */}
            {grouped || !resource.resourceId ? null : (
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
            /* Athena·DynamoDB have no logical-DB management at all, so both columns answer
               설정 불필요 rather than —. The dash is where a value we do not have goes; on a
               concept that does not exist it reads as missing data and sends the user looking
               for it. Step 5's 논리 DB 확인 says the same words for the same reason. */
            hasLogicalDatabases(resource.displayDbType ?? resource.resourceType) ? (
              /* A folded row's counts are a SUM across its databases, and the drill-in queries
                 one resource id. Opening the region id would answer with a list that cannot
                 match the number it was clicked from, so the aggregate is text, not a link. */
              <>
                <td className={idcStyles.table.approvalCell}>
                  <LogicalDbCountCell
                    count={resource.logicalDbCount}
                    label={`${resource.resourceName || resource.resourceId} 연동 논리 DB 목록 보기`}
                    onOpen={folded ? undefined : () => onLogicalDbOpen?.(resource)}
                  />
                </td>
                <td className={idcStyles.table.approvalCell}>
                  <LogicalDbCountCell
                    count={resource.excludedLogicalDbCount}
                    label={`${resource.resourceName || resource.resourceId} 연동 제외 대상 보기`}
                    onOpen={folded ? undefined : () => onLogicalDbOpen?.(resource)}
                  />
                </td>
              </>
            ) : (
              <>
                <td className={idcStyles.table.approvalCell}>
                  <NoLogicalDbCell />
                </td>
                <td className={idcStyles.table.approvalCell}>
                  <NoLogicalDbCell />
                </td>
              </>
            )
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

      if (!folded) return row;
      return (
        <Fragment key={rowKey}>
          {row}
          {/* The region's databases. Name, and what the name IS — read down the column it
              says Athena → Database, as on steps 1·2·3. Everything else is the region's own
              answer and does not vary per database, so those cells stay empty. */}
          {open &&
            members.map((member, index) => (
              <tr key={member.resourceId}>
                <td
                  className={cn(
                    idcStyles.table.approvalCell,
                    'font-mono text-[14px]',
                    textColors.primary,
                    idcStyles.table.group.childCell,
                    index === members.length - 1 && idcStyles.table.group.childCellLast,
                  )}
                >
                  {member.resourceName || PLACEHOLDER}
                </td>
                <td className={idcStyles.table.approvalCell} />
                <td className={cn(idcStyles.table.approvalCell, 'text-[12px]', textColors.secondary)}>
                  {GROUPED_CHILD_KIND_LABEL}
                </td>
                <td className={idcStyles.table.approvalCell} />
                <td className={idcStyles.table.approvalCell} />
                <td className={idcStyles.table.approvalCell} />
              </tr>
            ))}
        </Fragment>
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
