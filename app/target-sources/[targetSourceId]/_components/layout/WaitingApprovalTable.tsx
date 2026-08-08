'use client';

import { Fragment, memo, useMemo, useState } from 'react';
import { useClusterFold } from '@/app/hooks/useClusterFold';
import { useRailHover } from '@/app/hooks/useRailHover';
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
import {
  isRdsCluster,
  rdsInstanceLabel,
  sortRdsInstances,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';
import {
  Ec2InstanceTag,
  RdsClusterTag,
  RdsMemberChip,
  RdsSelectionChip,
} from '@/app/components/ui/RdsInstanceChips';
import { hasLogicalDatabases, isEc2Instance } from '@/lib/types';
import {
  INSTALL_STATUS_LABEL,
  type InstallStepCell,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import { idcStyles, primaryColors, statusColors, tableRowLift, textColors, cn } from '@/lib/theme';

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
  /**
   * What the Database Type column PRINTS — `metadata.database_type`, and on step 1 the user's
   * unsaved VM endpoint draft on top of it. It is a display value, not an identity: do not key
   * grouping or lookups on it (that is `resourceType`).
   */
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
   * The contract's top-level `resource_type`, carried verbatim for TYPE PREDICATES only —
   * currently the RDS-cluster tag. Never rendered and never used for grouping.
   *
   * It cannot be folded into `resourceType`: two consumers deliberately set that field to an
   * engine name (`ConfirmedIntegrationTable`, the step-4 install table) because it doubles as
   * the grouping key and the fold's label, so `resourceType` cannot answer "what KIND of
   * resource is this". Absent on rows whose source has no top-level type.
   */
  declaredResourceType?: string;
  /**
   * `approval` variant only — an RDS cluster's member instances, listed read-only beneath the
   * cluster row so an approver sees which instance the agent will connect through. Absent (the
   * normal case) leaves the row exactly as it was. Display order is applied here, not by the
   * caller: the array the caller holds is the wire's, which the payload echoes verbatim.
   */
  rdsInstanceCandidates?: readonly RdsInstanceCandidate[];
  /** The chosen member `resource_id`, an instance ARN (`metadata.selected_rds_instance_resource_id`) — marks one instance 선택됨. */
  selectedRdsInstanceResourceId?: string;
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
   * Raise the row height (py-4 → py-5) for the two-line cluster identity.
   *
   * Opt-in per consumer rather than derived from the variant: the `approval` variant also
   * serves the request-history modal (a 60vh scroll box) and the admin ops request tab, and
   * neither asked to give up a row of density. Only the step-2 and step-3 cards pass it.
   */
  raisedRows?: boolean;
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

// Row hover, declared as a theme token rather than via idcStyles.table.row — that token is shared
// with six other tables, and its tint (F7F8FA) measures 1.06:1 against white (invisible). Excluded
// rows had no hover at all: `rowExcluded` REPLACED `row`.
// Each state keeps its own lift so the excluded tint survives hover (1.10:1 each).
// `focus-within` mirrors hover: the row carries a copy button and tooltip triggers, so a keyboard
// user tabbing through gets the same row highlight a mouse user gets.
// The two hover values must never land on the same element: `cn` is a plain join, so two
// `focus-within:bg-*` classes would let CSS order pick the winner. Each branch owns both of its
// state colors; ROW_BASE carries no color at all.
// Why the tints lean blue (and what that reserves): see tableRowLift in lib/theme.ts.
export const ROW_BASE = tableRowLift.base;
export const ROW_TARGET = tableRowLift.target;
export const ROW_EXCLUDED = tableRowLift.excluded;

// Background alone marks position; it does not make a row easier to READ. Each column lifts on
// whichever axis still has headroom:
//
//   secondary columns  color  4E5968 -> 191F28 (6.12:1 -> 14.25:1 on the hover tint)
//   Resource Name      color  191F28 -> the primary hover blue, marking the row's anchor
//
// Weight was tried on the name (400 -> 600, safe from reflow because Geist Mono's advance width is
// weight-invariant) and removed: color plus weight on the one blue cell in the row read as shouting.
// One axis per column is the rule; the name already gets the loudest one.
// Dimming the OTHER rows was rejected: 4E5968 at opacity .75 is 4.0:1, under WCAG AA, and it
// would apply to most of the screen the whole time the pointer is in the table.
//
// Declared per cell: `cn` is a plain join, so a group-hover value must sit on the element that
// owns the resting value, not be layered over it from the row.
export const CELL_LIFT = tableRowLift.cellText;
// The DARK primary, not the base primary — see primaryColors.textGroupHover for why (contrast
// under the row's hover background). Lighter is not available: it is already below AA there.
export const NAME_LIFT = primaryColors.textGroupHover;

// Excluded rows REST one tier dimmer: all four text cells drop to gray-500 — 4.63:1 on the
// excluded tint, AA with margin, where the full-strength text made 제외 rows read identical to
// 대상 rows (the 1.05:1 background tint carries nothing). The hover/focus lifts above restore
// full contrast the moment the row is engaged, so the dim tier is never the reading surface.
// Chips and the reason chip keep full contrast: the verdict and the why must survive the fade.
// 3:1-grade dimming (8B95A1, 2.9:1) was considered and rejected — 13px body text is normal-size
// text under WCAG, and the reason column is content, not an inactive control.
export const DIM_TEXT = textColors.tertiary;

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

/** 논리 DB 라는 개념이 없는 엔진의 답 — see `hasLogicalDatabases`. */
export const NO_LOGICAL_DB_TEXT = '설정 불필요';

const NoLogicalDbCell = () => (
  <span className={cn('whitespace-nowrap text-[14px]', textColors.tertiary)}>
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
          'inline-flex items-center gap-1 whitespace-nowrap text-[14px] font-semibold',
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
  // Size stated, not inherited: unset, this lands on the 16px body size and the status
  // outgrows the row. 14px is the single size every cell in this table now shares.
  <span className={cn('whitespace-nowrap text-[14px] font-semibold', INSTALL_STATUS_TEXT[cell.status])}>
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
    raisedRows = false,
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
    // RDS cluster instance lists — shared fold policy (`useClusterFold`): open while the
    // cluster is part of the request, folded once it is excluded.
    const clusterFold = useClusterFold();
    // Tree rails: hovering any row of a group / cluster / folded region lights the whole rail.
    const railRow = useRailHover();

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
    const monoCell = 'whitespace-nowrap font-mono text-[14px]';

    // `grouped` only indents the identity cell — every other cell is identical whether the row
    // stands alone or hangs under a parent, so a group never changes what a row says.
    const renderRow = (
      resource: WaitingApprovalResource,
      grouped = false,
      lastInGroup = false,
      railKey?: string,
    ) => {
      const excluded = !resource.selected;
      const rowKey = resource.rowKey || resource.resourceId || resource.resourceName;
      // A folded row STANDS FOR an Athena region (steps 6·7) — see `foldedMembers`.
      const members = resource.foldedMembers;
      const folded = !!members?.length;
      const open = folded && (expandFolds || expandedFolds.has(rowKey));
      // The fold has TWO entry points, the chevron and the row itself. Both have to go quiet
      // while a filter owns the open state, or the one left live writes the press into
      // `expandedFolds` and clearing the filter leaves the fold open — the opposite of what
      // was pressed. One flag so the two cannot drift apart again.
      const foldToggleable = folded && !expandFolds;
      const foldLabel = getDatabaseShortLabel(resource.resourceType) || PLACEHOLDER;
      // The visible fallback is a glyph; speech gets a word. An em-dash read aloud in place of
      // an engine name says nothing a listener can use.
      const foldSpokenLabel = getDatabaseShortLabel(resource.resourceType) || '유형 미상';
      // An RDS cluster's member instances (steps 2·3). Reader-first display order is applied
      // here; the caller holds the wire array, which the approval payload echoes verbatim.
      const instances = variant === 'approval' && resource.rdsInstanceCandidates?.length
        ? sortRdsInstances(resource.rdsInstanceCandidates)
        : [];
      const hasInstances = instances.length > 0;
      const instanceFold = clusterFold(rowKey, resource.selected);
      const instancesOpen = hasInstances && instanceFold.open;
      // Keyed on the declared top-level type, never on `resourceType` — see the field's note.
      const isCluster = isRdsCluster(resource.declaredResourceType ?? '');
      const isEc2 = isEc2Instance(resource.declaredResourceType);
      // Every row of one rail shares a key: a group's children take the group's (passed in by
      // the caller), a cluster or a folded region and its members take the row's own. Rows that
      // draw NO rail get no handlers: this table is memo()'d and paginated, and lighting nothing
      // on every pointer move would re-render the whole list for a class with no effect.
      const rail = grouped || instancesOpen || (folded && open) ? railRow(railKey ?? rowKey) : undefined;
      const row = (
        <tr
          // `resource_id` is optional in the contract, so two id-less rows would collide on
          // one '' key and React would drop a row. `rowKey` is for consumers that HAVE an
          // identity they may not render (IDC's internal NLB key — design-spec §8).
          key={rowKey}
          className={cn(
            ROW_BASE,
            excluded ? ROW_EXCLUDED : ROW_TARGET,
            foldToggleable && 'cursor-pointer',
            rail?.className,
          )}
          onClick={foldToggleable ? () => toggleFold(rowKey) : undefined}
          onMouseEnter={rail?.onMouseEnter}
          onMouseLeave={rail?.onMouseLeave}
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
              (instancesOpen || (folded && open)) && idcStyles.table.group.parentCell,
            )}
          >
            {hasInstances ? (
              // A cluster keeps its own name — two-line identity (owner request): the tag sits
              // ABOVE the name, and the chevron centres on the pair.
              // Same stack as the step-1 cluster row so the three steps read identically.
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  // No aria-controls: the instance rows are `<tr>` siblings with no single
                  // element to point at (APG disclosure: aria-expanded alone is conforming).
                  aria-expanded={instancesOpen}
                  aria-label={`${resource.resourceName} 인스턴스 목록 ${instancesOpen ? '접기' : '펼치기'}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    instanceFold.toggle();
                  }}
                  className={cn(
                    idcStyles.table.group.toggle,
                    instancesOpen
                      ? idcStyles.table.group.toggleOpen
                      : idcStyles.table.group.toggleClosed,
                    primaryColors.focusRing,
                  )}
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
                <span className="flex min-w-0 flex-col items-start gap-1">
                  {/* Count only, on the tag line — same stack as the step-1 cluster row. The
                      선택됨 chip on the instance row is the single place the choice is stated,
                      so the parent can never contradict it. */}
                  <span className="flex items-center gap-2">
                    <RdsClusterTag />
                    <span className={cn('whitespace-nowrap font-sans text-[12px]', textColors.tertiary)}>
                      {instances.length}개 인스턴스
                    </span>
                  </span>
                  <Tooltip
                    content={<IdentifierTip label="Resource Name" value={resource.resourceName} />}
                    variant="value"
                    size="md"
                    triggerClassName="min-w-0 max-w-[200px] block"
                    truncatedOnly
                  >
                    <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
                  </Tooltip>
                </span>
              </span>
            ) : folded ? (
              // A region has no resource name, so the cell carries the engine's label instead.
              // It reads in the SAME type as every other name in this column, NOT in the group
              // parent's heavier weight above: that weight separates a parent from the children
              // right under it, and here the row's neighbours are ordinary resources.
              <span className={idcStyles.table.group.lead}>
                {!foldToggleable ? (
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
                    aria-label={`${foldSpokenLabel} ${resource.region} 데이터베이스 목록 ${open ? '접기' : '펼치기'}`}
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
            ) : isCluster || isEc2 ? (
              // Steps 4·6·7: the tag alone. Those steps list what is being installed and
              // connected, not what is being chosen, so the member instances stay a steps 1–3
              // concern — but the row still has to say it is a cluster, in the same stack.
              // EC2 rides the same branch: it has no members to fold, so the tag is all it needs,
              // and steps 2·3 reach it here too (the branch above is cluster-with-instances only).
              <span className="flex min-w-0 flex-col items-start gap-1">
                {isCluster ? <RdsClusterTag /> : <Ec2InstanceTag />}
                <Tooltip
                  content={<IdentifierTip label="Resource Name" value={resource.resourceName} />}
                  variant="value"
                  size="md"
                  triggerClassName="min-w-0 max-w-[200px] block"
                  truncatedOnly
                >
                  <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
                </Tooltip>
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
            onClick={foldToggleable ? (event) => event.stopPropagation() : undefined}
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
                sizeClass="text-[14px]"
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
                  'text-[14px]',
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

      if (hasInstances) {
        return (
          <Fragment key={rowKey}>
            {row}
            {/* The cluster's member instances — read-only here: the choice was made on step 1
                and this surface exists to review it, so there are no radios. Everything the
                cluster answers for (id, verdict, reason) stays on the parent row. */}
            {instancesOpen &&
              instances.map((instance, index) => (
                // The instances inherit their cluster's tier: an excluded cluster is not
                // being installed, so its members are not either, and leaving them at full
                // contrast made a dimmed parent read as a rendering fault.
                <tr
                  key={instance.resource_id}
                  className={cn(ROW_BASE, excluded ? ROW_EXCLUDED : ROW_TARGET, rail?.className)}
                  onMouseEnter={rail?.onMouseEnter}
                  onMouseLeave={rail?.onMouseLeave}
                >
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      'font-mono text-[14px]',
                      excluded ? DIM_TEXT : textColors.primary,
                      idcStyles.table.group.childCell,
                      index === instances.length - 1 && idcStyles.table.group.childCellLast,
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{rdsInstanceLabel(instance)}</span>
                      <RdsMemberChip role={instance.cluster_member_role} />
                      {instance.resource_id === resource.selectedRdsInstanceResourceId && (
                        <RdsSelectionChip />
                      )}
                    </span>
                  </td>
                  <td className={idcStyles.table.approvalCell} />
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      'text-[14px]',
                      excluded ? DIM_TEXT : textColors.secondary,
                    )}
                  >
                    Instance
                  </td>
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      monoCell,
                      excluded ? DIM_TEXT : textColors.secondary,
                    )}
                  >
                    {instance.availability_zone ?? ''}
                  </td>
                  <td className={idcStyles.table.approvalCell} />
                  <td className={idcStyles.table.approvalCell} />
                </tr>
              ))}
          </Fragment>
        );
      }

      if (!folded) return row;
      return (
        <Fragment key={rowKey}>
          {row}
          {/* The region's databases. Name, and what the name IS — read down the column it
              says Athena → Database, as on steps 1·2·3. Everything else is the region's own
              answer and does not vary per database, so those cells stay empty. */}
          {open &&
            members.map((member, index) => (
              <tr
                key={member.resourceId}
                className={cn(ROW_BASE, rail?.className)}
                onMouseEnter={rail?.onMouseEnter}
                onMouseLeave={rail?.onMouseLeave}
              >
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
                <td className={cn(idcStyles.table.approvalCell, 'text-[14px]', textColors.secondary)}>
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
          {/* approval rows raised one step over approvalCell's py-4 (owner request, step-1
              table matches). Variant-scoped: the install/confirmed tables (steps 4·6) keep
              the shared token's rhythm. :not([colspan]) keeps spanning cells (panel-style
              tds zero their own padding) out of the override — see CandidateResourceTable. */}
          <table
            className={cn(
              'w-full',
              raisedRows && '[&_td:not([colspan])]:py-5',
              // A group is three tbodies, and `body`'s divide-y stops at each tbody's edge.
              idcStyles.table.tbodySeam,
            )}
          >
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
                      rail={railRow(group.key)}
                    >
                      {/* Resource ID stays blank: the catalog id lives only inside each child's
                          resource_id string, which we do not parse. Database Type and Region are
                          the pair the group is keyed on, so they are the parent's own values and
                          the children below leave those two cells empty. */}
                      <td className={idcStyles.table.approvalCell} />
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          'text-[14px]',
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
                      renderRow(resource, true, index === group.rows.length - 1, group.key),
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
