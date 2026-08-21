'use client';

import { Fragment, memo, useMemo, useState, type ReactNode } from 'react';
import { useClusterFold } from '@/app/hooks/useClusterFold';
import { useRailHover } from '@/app/hooks/useRailHover';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { ChevronRightIcon, ExcludedIcon, StatusWarningIcon } from '@/app/components/ui/icons';
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
  sortRdsInstances,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';
import {
  Ec2InstanceTag,
  RdsChosenInstanceLine,
  RdsClusterTag,
} from '@/app/components/ui/RdsInstanceChips';
import { RdsInstancePanel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
import { RESIZE_LABEL_ATTR, type ColumnResize } from '@/app/components/ui/useColumnResize';
import { hasLogicalDatabases, isEc2Instance, resolveExclusionReason } from '@/lib/types';
import {
  INSTALL_STATUS_LABEL,
  type InstallStepCell,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import {
  bgColors,
  idcStyles,
  primaryColors,
  statusColors,
  tableRowLift,
  textColors,
  verdictRailClass,
  verdictText,
  cn,
} from '@/lib/theme';

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
   * `metadata.database_type`, and on step 1 the user's unsaved VM endpoint draft on top of it.
   * The Database Type column prints it, and the 논리 DB columns judge on it — it is the only
   * field that carries a database type, so a verdict that needs one reads THIS and nothing else.
   * Still not an identity: do not key grouping or lookups on it (that is `resourceType`).
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
 * `plain` (admin ops 확정 정보): identity and attributes only. That slot asks a question ABOUT the
 * row, and this surface owns no per-row question — the logical-DB counts belong to step 5, the
 * verdict to steps 2·3 — so it is dropped rather than filled with a value the screen cannot manage.
 */
type WaitingApprovalTableVariant = 'approval' | 'confirmed' | 'install' | 'plain';

export interface ApprovalIdentityCell {
  label: string;
  render: (resource: WaitingApprovalResource) => ReactNode;
  /** 헤더 폭 — 호출자의 다른 단계 표에서 그대로 복사해, 단계끼리 열이 어긋나지 않게 한다. */
  widthClass?: string;
  /**
   * 헤더 내용 — 글자 말고 다른 것이 붙는 열에만(출발지 열의 설명 툴팁 등). `label` 은
   * 그대로 남는다: React key 이자, 여기 없을 때 그리는 기본값이다.
   */
  head?: ReactNode;
}

/**
 * Replaces the Resource Name + Resource ID pair with the caller's own leading columns.
 *
 * For a provider whose rows are named by a scan that pair IS the identity. IDC's is not:
 * it has no scan-assigned name, and its `resource_id` is an internal NLB key it may not
 * print (design-spec §8). An IDC row is identified the way steps 2·3·5·6·7 identify it —
 * 구분 · 접속 주소 · Port · Database Type.
 */
export interface ApprovalIdentityColumns {
  columns: readonly ApprovalIdentityCell[];
  /** 검색창 placeholder — 표가 보여주지 않는 필드를 약속하지 않도록 같이 바꾼다. */
  searchPlaceholder?: string;
  /**
   * Database Type 필터 옵션을 만드는 접근자. 옵션은 이 표가 실제로 찍는 글자여야 하는데,
   * 앞 열을 호출자가 그리면 그 글자도 호출자의 것이다 — IDC 는 MSSQL 이라 쓰고 클라우드
   * 라벨 맵은 SQL Server 라 쓴다. 없으면 훅의 기본 접근자를 그대로 쓴다.
   */
  dbTypeLabel?: (resource: WaitingApprovalResource) => string;
}

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
  /**
   * `install` variant only — see `ApprovalIdentityColumns`. The other two variants group,
   * fold and cluster on the name/id pair, so the swap is not offered there.
   */
  identityColumns?: ApprovalIdentityColumns;
  /**
   * `confirmed` variant only — drag-resizable column widths (useColumnResize with
   * `clampToContent`): the table goes `table-fixed`, every header cell takes a width and
   * a handle, and truncated values are uncovered by dragging the divider (round 3).
   * Instantiated by the CALLER, not here, so the 「열 너비 초기화」 button in the counter
   * band can reach `reset()`.
   */
  columns?: ColumnResize;
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

// 제외 행을 한 단 흐리게 하던 처리(gray-500)는 없앴다.
//
// 흐리게 한다는 것은 "덜 중요하다"는 뜻인데, 승인 화면에서 제외 행은 가장 감사(audit)해야 하는
// 행이다 — 누락을 잡으라고 만든 화면이 누락을 읽기 어렵게 만들고 있었다. 원래 이 처리가 있었던
// 이유는 배경 틴트(1.05:1)가 아무것도 말하지 못해서였고, 그 일은 이제 `verdictRail` 이 맡는다.

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

/** 논리 DB 라는 개념이 없는 엔진의 답 — see `hasLogicalDatabases`. */
export const NO_LOGICAL_DB_TEXT = '설정 불필요';

const NoLogicalDbCell = () => (
  <span className={cn('whitespace-nowrap text-[14px]', textColors.tertiary)}>
    {NO_LOGICAL_DB_TEXT}
  </span>
);

const PLACEHOLDER = '—';

// 판정은 태그가 아니라 글자다 — 근거는 `verdictText`.
//
// Ineligible is its own verdict, not a flavour of excluded. The two answer different
// questions: excluded means a person chose to leave the resource out and can put it back by
// re-selecting, while ineligible means the scan found it unreachable and no amount of
// re-selecting changes that. Step 1 already draws that line (the row's checkbox is disabled
// there); collapsing it back into excluded made a system verdict look revisable.
//
// 대상만 아이콘이 없다: 목록의 대부분이 대상이라, 아이콘이 붙은 줄을 세는 것이 곧 예외를 세는 일이다.
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
    return (
      <span className={cn(verdictText.base, verdictText.ineligible)}>
        <StatusWarningIcon className={verdictText.icon} />
        연동 불가
      </span>
    );
  }
  if (!excluded) return <span className={cn(verdictText.base, verdictText.target)}>대상</span>;
  return (
    <span className={cn(verdictText.base, verdictText.excluded)}>
      <ExcludedIcon className={verdictText.icon} />
      제외
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
// have `recommend_fail_reason`, so read both.
const ReasonCell = ({ resource }: { resource: WaitingApprovalResource }) => {
  if (resource.selected) return null;
  const resolved = resolveExclusionReason(resource.exclusionReason, resource.recommendFailReason);
  if (!resolved) return null;
  return (
    <ReasonChipInline
      reason={resolved.text}
      summary={clampReason(resolved.text)}
      code={resolved.code}
      meta={resource.exclusionMeta}
    />
  );
};

/**
 * Confirmed-column defaults, px — the screen's own measured columns (1745px audit:
 * 162·312·142·156·118·96; 종류 = chip 82px + approvalCell padding 36px + slack).
 * A RECORD, not width classes, because the `<table>` must carry width = Σ(columns)
 * (round 4): under `w-full` the fixed algorithm redistributes any slack across the
 * fixed columns, so below the container width every column silently stretched past
 * its stated width — a 16px keyboard step moved ~3px on screen, and the min/max
 * bounds the drag enforces were not the widths being rendered.
 */
const CONFIRMED_COLUMN_WIDTHS = {
  kind: 128,
  name: 162,
  id: 312,
  dbType: 142,
  region: 156,
  logicalDb: 118,
  excluded: 96,
} as const;

type ConfirmedColumnKey = keyof typeof CONFIRMED_COLUMN_WIDTHS;

/** One column's rendered width: the dragged width if the user set one, else the default. */
const confirmedColumnWidth = (key: ConfirmedColumnKey, columns?: ColumnResize): number =>
  columns?.widthOf(key)?.width ?? CONFIRMED_COLUMN_WIDTHS[key];

/**
 * Confirmed-table header cell — width-declared and drag-resizable (round 3). `relative`
 * seats the handle at the cell's right edge (useColumnResize contract); the width is a
 * style either way (default or dragged), so server and client always agree on it.
 */
const ResizableTh = ({
  columns,
  columnKey,
  label,
  className,
}: {
  columns?: ColumnResize;
  columnKey: ConfirmedColumnKey;
  label: string;
  className?: string;
}) => (
  <th
    className={cn(idcStyles.table.approvalHeaderCell, 'relative', className)}
    style={{ width: confirmedColumnWidth(columnKey, columns) }}
  >
    {/* The label clips ITSELF (round 4): a bare text node in a hard-shrunk `<th>` paints
        over the neighbouring header. The attribute doubles as the hook's floor probe —
        drags stop at the width where this label would start to clip, so post-drag the
        ellipsis only ever shows for widths restored from an older storage version.
        inline-block, NOT block: the probe reads scrollWidth, and a block span's
        scrollWidth is its box (the th's width), which froze every column at its current
        width. A shrink-to-fit box reports the TEXT in both states — its own width while
        the label fits, the full text while clipped. max-w-full is what lets it clip. */}
    <span {...{ [RESIZE_LABEL_ATTR]: '' }} className="inline-block max-w-full truncate align-bottom">
      {label}
    </span>
    {columns && <span {...columns.handleProps(columnKey, label)} />}
  </th>
);

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
    identityColumns,
    columns,
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
    const plainVariant = variant === 'plain';

    // Round 3 (시안 F): the kind chip leaves the two-line identity stack and becomes its own
    // leading column, taking the row to one line (py-4 + 20px = 52px). Only worth a column
    // when at least one visible row would put a chip in it — Azure/GCP rows carry no kind
    // tag today, and a permanently blank leading column is dead space, not a colour anchor.
    const confirmedKindColumn =
      confirmedVariant &&
      resources.some(
        (resource) =>
          isRdsCluster(resource.declaredResourceType ?? '') ||
          isEc2Instance(resource.declaredResourceType),
      );

    // Colorless — each row picks its resting tier (dim vs secondary) at the cell.
    const monoCell = 'whitespace-nowrap font-mono text-[14px]';

    // Round 4 covered-clip (owner: "왼쪽 부분이 오른쪽에 덮인 느낌"): every confirmed cell
    // clips at its own edge so an overlong value runs through the cell's right padding and
    // cuts mid-letter exactly at the column stroke — the Azure grammar where the next column
    // COVERS the value and dragging the divider uncovers it. Overflow clips at the padding
    // box, so the cut lands on the border line, not 18px short of it. An ellipsis would say
    // "shortened here" instead of "continues underneath", so the …-drawing `truncate` is off
    // in this variant. nowrap on the td keeps chips and plain-text cells to the single 52px
    // line without each child declaring it.
    const coveredCell = confirmedVariant ? 'overflow-hidden whitespace-nowrap' : undefined;

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
      // An excluded cluster submits no instance, so there is nothing chosen to name.
      const chosenInstance = instances.find(
        (instance) => instance.resource_id === resource.selectedRdsInstanceResourceId,
      );
      const instanceFold = clusterFold(rowKey, resource.selected);
      const instancesOpen = hasInstances && instanceFold.open;
      // Keyed on the declared top-level type, never on `resourceType` — see the field's note.
      const isCluster = isRdsCluster(resource.declaredResourceType ?? '');
      const isEc2 = isEc2Instance(resource.declaredResourceType);
      // Every row of one rail shares a key: a group's children take the group's (passed in by
      // the caller), a folded region and its members take the row's own. Rows that draw NO rail
      // get no handlers: this table is memo()'d and paginated, and lighting nothing on every
      // pointer move would re-render the whole list for a class with no effect. An open cluster
      // is one such row now — its members moved into the accordion body, which draws its own
      // rail, so there is no second row left to light with it.
      const rail = grouped || (folded && open) ? railRow(railKey ?? rowKey) : undefined;
      const row = (
        <tr
          // `resource_id` is optional in the contract, so two id-less rows would collide on
          // one '' key and React would drop a row. `rowKey` is for consumers that HAVE an
          // identity they may not render (IDC's internal NLB key — design-spec §8).
          key={rowKey}
          className={cn(
            ROW_BASE,
            // An open cluster row is an accordion HEADER, so it wears the body's own surface:
            // the two sharing one tint with nothing between them is what makes the pair read as
            // one block that opened rather than as a row with a panel underneath it — the same
            // override step 1's cluster row makes.
            instancesOpen ? bgColors.panel : excluded ? ROW_EXCLUDED : ROW_TARGET,
            foldToggleable && 'cursor-pointer',
            rail?.className,
          )}
          onClick={foldToggleable ? () => toggleFold(rowKey) : undefined}
          onMouseEnter={rail?.onMouseEnter}
          onMouseLeave={rail?.onMouseLeave}
        >
          {identityColumns ? (
            /* 호출자가 앞 열 전체를 그린다. 판정 레일과 26px 들여쓰기는 첫 칸의 몫이고,
               나머지는 여느 셀과 같다 — 이 표의 다른 열들과 같은 리듬을 유지한다. */
            identityColumns.columns.map((column, index) => (
              <td
                key={column.label}
                className={cn(
                  idcStyles.table.approvalCell,
                  index === 0 && verdictRailClass(excluded),
                  index === 0 && idcStyles.table.nameCell,
                )}
              >
                {column.render(resource)}
              </td>
            ))
          ) : (
            <>
          {/* Round 3 — the chip's own column. Rows without a kind stay blank: an em-dash
              would claim "no kind" as a fact this table does not have. coveredCell so a
              hard-shrunk column clips its chip at the stroke instead of painting it over
              the name. */}
          {confirmedKindColumn && (
            <td className={cn(idcStyles.table.approvalCell, coveredCell)}>
              {isCluster ? <RdsClusterTag /> : isEc2 ? <Ec2InstanceTag /> : null}
            </td>
          )}
          {/* One line, always. Wrapping turned the row's darkest column into a 2–3 line
              block and left row heights ragged (59/69/75px); the full name is in the tip. */}
          <td
            className={cn(
              idcStyles.table.approvalCell,
              coveredCell,
              'font-mono text-[14px]',
              textColors.primary,
              NAME_LIFT,
              // 그룹 자식 행은 레일을 그리지 않는다: 첫 셀 왼쪽 0~4px 는 그룹 트리 레일이 이미
              // 말하는 자리이고, 판정은 부모 행의 집계(대상 N / 제외 M)가 대신 답한다.
              !grouped &&
                verdictRailClass(
                  excluded,
                  resource.integrationCategory === 'INSTALL_INELIGIBLE',
                ),
              // A grouped child's indent already carries the column's 26px — the two padding
              // tokens must never both land on one cell.
              !grouped && idcStyles.table.nameCell,
              grouped && idcStyles.table.group.childCell,
              grouped && lastInGroup && idcStyles.table.group.childCellLast,
              (instancesOpen || (folded && open)) && idcStyles.table.group.parentCell,
            )}
          >
            {hasInstances ? (
              // Three-line identity, exactly step 1's: kind tag → cluster name → the instance it
              // connects through (owner, 2026-08-13; recorded verbatim in the propagation section
              // of `docs/ux/benchmark/step1-resource-table.md`). No positional lift here — with
              // three lines the name is already the middle one, which is the line `lead` centres
              // the chevron on.
              <span className={idcStyles.table.group.lead}>
                <button
                  type="button"
                  // No aria-controls: the band is unmounted while closed, so the reference
                  // would dangle half the time — worse than the optional attribute's absence
                  // (APG disclosure: aria-expanded alone is conforming).
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
                <span className="flex w-full min-w-0 flex-col items-start gap-1">
                  <RdsClusterTag />
                  <Tooltip
                    content={<IdentifierTip label="Resource Name" value={resource.resourceName} />}
                    variant="value"
                    size="md"
                    triggerClassName="min-w-0 max-w-[200px] block"
                    truncatedOnly
                  >
                    <span className="block truncate">{resource.resourceName || PLACEHOLDER}</span>
                  </Tooltip>
                  {/* The count it replaces was the tally PR #630 threw out — and on a REVIEW
                      surface it was the wrong fact besides: which member the request connects
                      through is the thing being reviewed, and the row said only how many there
                      were. `RdsChosenInstanceLine` falls back to the count when the cluster is
                      excluded, because then there is no selection to name. */}
                  <RdsChosenInstanceLine chosen={chosenInstance} total={instances.length} />
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
            ) : (isCluster || isEc2) && !confirmedVariant ? (
              // Step 4: the tag alone. Those steps list what is being installed and
              // connected, not what is being chosen, so the member instances stay a steps 1–3
              // concern — but the row still has to say it is a cluster, in the same stack.
              // EC2 rides the same branch: it has no members to fold, so the tag is all it needs,
              // and steps 2·3 reach it here too (the branch above is cluster-with-instances only).
              // The confirmed tables (steps 6·7) left this stack in round 3: their chip lives in
              // the 종류 column, so they fall through to the one-line name below.
              <span className={cn('flex min-w-0 flex-col items-start gap-1', idcStyles.table.stackedIdentityLift)}>
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
                // In the fixed-layout confirmed table the COLUMN owns the truncation point —
                // a per-cell 200px clamp would make dragging the column wider reveal nothing.
                // `w-full` because the trigger is an inline-flex box: left to shrink-to-fit it
                // sizes to the nowrap name and paints over the next column (the 200px cap was
                // what contained it before). The child needs min-w-0 to shrink inside it —
                // the same recipe ResourceIdCell already uses.
                triggerClassName={confirmedVariant ? 'min-w-0 w-full' : 'min-w-0 max-w-[200px] block'}
                truncatedOnly
              >
                {/* Confirmed: no self-truncation — the overflow runs on and the TD's own
                    covered-clip cuts it at the column stroke (round 4). */}
                <span
                  className={cn(
                    'block min-w-0',
                    confirmedVariant ? 'whitespace-nowrap' : 'truncate',
                  )}
                >
                  {resource.resourceName || PLACEHOLDER}
                </span>
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
            className={cn(idcStyles.table.approvalCell, coveredCell)}
            onClick={foldToggleable ? (event) => event.stopPropagation() : undefined}
          >
            {/* An absent id renders nothing rather than a bare control: a consumer that
                withholds it (IDC's resource_id is internal) would otherwise get a
                focusable "Resource ID 복사" on every row, copying ''. */}
            {grouped || !resource.resourceId ? null : (
              // 260px (the cell default) plus a non-wrapping Region overran the card.
              // Confirmed tables let the COLUMN own the truncation point instead (round 3):
              // the cell fills its fixed column, and the drag handle is the way to see more.
              // hardClip joins the round-4 covered grammar: the ARN cuts mid-letter rather
              // than ellipsizing, saying "continues underneath" like every other cell here.
              <ResourceIdCell
                value={resource.resourceId}
                label="Resource ID"
                maxWidthClass={confirmedVariant ? 'w-full max-w-full' : 'max-w-[220px]'}
                sizeClass="text-[14px]"
                textClassName={cn(textColors.secondary, CELL_LIFT)}
                hardClip={confirmedVariant}
              />
            )}
          </td>
            </>
          )}
          {/* DB Type is a repeating attribute, not a status — one badge per row (the
              verdict) is enough; a second pill would compete with it.
              Inside a group this column carries what the row IS: the parent says `Athena`,
              each child says `Database`. The Region column repeats the parent's value on every
              child (owner, 2026-08-12) — a column is read down, and blanks under it read as
              "no region" once the parent has scrolled away. */}
          {!installVariant && (
            <>
              <td
                className={cn(
                  idcStyles.table.approvalCell,
                  coveredCell,
                  'text-[14px]',
                  textColors.secondary,
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
                  coveredCell,
                  monoCell,
                  textColors.secondary,
                  CELL_LIFT,
                )}
              >
                {resource.region || PLACEHOLDER}
              </td>
            </>
          )}
          {plainVariant ? null : confirmedVariant ? (
            /* Athena·DynamoDB have no logical-DB management at all, so both columns answer
               설정 불필요 rather than —. The dash is where a value we do not have goes; on a
               concept that does not exist it reads as missing data and sends the user looking
               for it. Step 5's 논리 DB 확인 says the same words for the same reason.

               `database_type` ONLY — never `resourceType`. The two are different vocabularies:
               the database type is `athena`, the resource type is `AWS_ATHENA_DATABASE`, and
               this judgment lists database types. The old fallback let a value that can never
               match cast the verdict. The DB Type LABEL above still falls back, because there
               printing something beats printing nothing — a label is not a verdict. */
            hasLogicalDatabases(resource.displayDbType) ? (
              /* A folded row's counts are a SUM across its databases, and the drill-in queries
                 one resource id. Opening the region id would answer with a list that cannot
                 match the number it was clicked from, so the aggregate is text, not a link. */
              <>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)}>
                  <LogicalDbCountCell
                    count={resource.logicalDbCount}
                    label={`${resource.resourceName || resource.resourceId} 연동 논리 DB 목록 보기`}
                    onOpen={
                      // 화살표 함수는 언제나 truthy 다 — `onLogicalDbOpen` 을 안 준 호출자(5개 중
                      // 4개)는 눌러도 아무 일 없는 버튼을 얻는다. IDC 쪽 쌍둥이는 0dc43bd7 에서
                      // 고쳤고, 이건 그 나머지 절반이다.
                      folded || !onLogicalDbOpen ? undefined : () => onLogicalDbOpen(resource)
                    }
                  />
                </td>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)}>
                  <LogicalDbCountCell
                    count={resource.excludedLogicalDbCount}
                    label={`${resource.resourceName || resource.resourceId} 연동 제외 대상 보기`}
                    onOpen={
                      // 화살표 함수는 언제나 truthy 다 — `onLogicalDbOpen` 을 안 준 호출자(5개 중
                      // 4개)는 눌러도 아무 일 없는 버튼을 얻는다. IDC 쪽 쌍둥이는 0dc43bd7 에서
                      // 고쳤고, 이건 그 나머지 절반이다.
                      folded || !onLogicalDbOpen ? undefined : () => onLogicalDbOpen(resource)
                    }
                  />
                </td>
              </>
            ) : (
              <>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)}>
                  <NoLogicalDbCell />
                </td>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)}>
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
            {/* The cluster's member instances — the SAME accordion body step 1 opens, in its
                read-only mode: the choice was made there and this surface exists to review it,
                so the radios are gone and the 선택됨 chip states the pick (owner, 2026-08-13:
                "모든 Step에 적용").

                They used to be rows of this table, which cost more than the swap saved: three
                of the six columns are the cluster's own answer (id, verdict, reason — one
                decision, not one per member) so they sat empty, the endpoint had no column at
                all, and the AZ was filed under the "Region" header for want of anywhere else.
                Inside the body those three have their own labelled columns. */}
            {instancesOpen && (
              <RdsInstancePanel
                clusterId={rowKey}
                clusterName={resource.resourceName ?? resource.resourceId}
                showCheckboxColumn={false}
                colSpan={6}
                instances={instances}
                chosenResourceId={resource.selectedRdsInstanceResourceId ?? undefined}
                selectable={false}
                readonly
              />
            )}
          </Fragment>
        );
      }

      if (!folded) return row;
      return (
        <Fragment key={rowKey}>
          {row}
          {/* The region's databases. Name, what the name IS, and where it is — read down the
              columns they say Athena → Database and repeat the region, as on steps 1·2·3
              (owner, 2026-08-13). A column is read DOWN: a blank region beside every database
              reads as "no region", and the row that carries the value scrolls off as soon as
              the fold is long. Everything else IS the region's own single answer (its logical-DB
              counts, its verdict) and would be a per-database claim nobody made, so those cells
              stay empty. */}
          {open &&
            members.map((member, index) => (
              <tr
                key={member.resourceId}
                className={cn(ROW_BASE, rail?.className)}
                onMouseEnter={rail?.onMouseEnter}
                onMouseLeave={rail?.onMouseLeave}
              >
                {/* Round 3 — the fold's members keep column registration with the 종류 column. */}
                {confirmedKindColumn && <td className={cn(idcStyles.table.approvalCell, coveredCell)} />}
                <td
                  className={cn(
                    idcStyles.table.approvalCell,
                    coveredCell,
                    'font-mono text-[14px]',
                    textColors.primary,
                    idcStyles.table.group.childCell,
                    index === members.length - 1 && idcStyles.table.group.childCellLast,
                  )}
                >
                  {member.resourceName || PLACEHOLDER}
                </td>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)} />
                <td className={cn(idcStyles.table.approvalCell, coveredCell, 'text-[14px]', textColors.secondary)}>
                  {GROUPED_CHILD_KIND_LABEL}
                </td>
                <td className={cn(idcStyles.table.approvalCell, coveredCell, monoCell, textColors.secondary)}>
                  {resource.region || PLACEHOLDER}
                </td>
                <td className={cn(idcStyles.table.approvalCell, coveredCell)} />
                <td className={cn(idcStyles.table.approvalCell, coveredCell)} />
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
              // Round 3: fixed layout is what lets the resize handles rule — in auto layout
              // nowrap content dictates the column and dragging changes nothing visible.
              // Round 4: consoleGrid draws the boundary the covered-clip cells cut against,
              // and the table's width IS the column sum (style below) instead of w-full —
              // see CONFIRMED_COLUMN_WIDTHS for what w-full did to the stated widths.
              confirmedVariant ? cn('table-fixed', idcStyles.table.consoleGrid) : 'w-full',
              raisedRows && '[&_td:not([colspan])]:py-5',
              // A group is three tbodies, and `body`'s divide-y stops at each tbody's edge.
              idcStyles.table.tbodySeam,
            )}
            style={
              confirmedVariant
                ? {
                    width: (Object.keys(CONFIRMED_COLUMN_WIDTHS) as ConfirmedColumnKey[])
                      .filter((key) => key !== 'kind' || confirmedKindColumn)
                      .reduce((sum, key) => sum + confirmedColumnWidth(key, columns), 0),
                  }
                : undefined
            }
          >
            <thead
              className={
                confirmedVariant ? idcStyles.table.approvalHeaderFlat : idcStyles.table.approvalHeader
              }
            >
              {/* Identity (name → id) → attributes (type · region) → decision (verdict → reason).
                  The scan anchor is the human-readable name, not a 3-value category column. */}
              <tr className="whitespace-nowrap">
                {confirmedVariant ? (
                  /* Round 3 console header — every column declared and resizable; the
                     defaults live in CONFIRMED_COLUMN_WIDTHS. */
                  <>
                    {confirmedKindColumn && (
                      <ResizableTh columns={columns} columnKey="kind" label="종류" />
                    )}
                    <ResizableTh
                      columns={columns}
                      columnKey="name"
                      label="Resource Name"
                      className={idcStyles.table.nameCell}
                    />
                    <ResizableTh columns={columns} columnKey="id" label="Resource ID" />
                    <ResizableTh columns={columns} columnKey="dbType" label="Database Type" />
                    <ResizableTh columns={columns} columnKey="region" label={regionLabel} />
                    <ResizableTh columns={columns} columnKey="logicalDb" label="연동 논리 DB" />
                    <ResizableTh columns={columns} columnKey="excluded" label="연동 제외" />
                  </>
                ) : identityColumns ? (
                  identityColumns.columns.map((column, index) => (
                    <th
                      key={column.label}
                      className={cn(
                        idcStyles.table.approvalHeaderCell,
                        index === 0 && idcStyles.table.nameCell,
                        column.widthClass,
                      )}
                    >
                      {column.head ?? column.label}
                    </th>
                  ))
                ) : (
                  <>
                    <th className={cn(idcStyles.table.approvalHeaderCell, idcStyles.table.nameCell)}>Resource Name</th>
                    <th className={idcStyles.table.approvalHeaderCell}>Resource ID</th>
                  </>
                )}
                {/* Step 4 drops the two attribute columns: the engine was settled back on
                    steps 1·2 and the install runs the same either way, and the region is a
                    constant within one target source (and already inside the resource id).
                    What they cost — 250px — is what 상태/안내 need to stay on screen.
                    The confirmed variant already declared its whole header above. */}
                {!installVariant && !confirmedVariant && (
                  <>
                    <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                    <th className={idcStyles.table.approvalHeaderCell}>{regionLabel}</th>
                  </>
                )}
                {plainVariant || confirmedVariant ? null : installVariant ? (
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
                  <tbody
                    key={section.key}
                    // Round 3: the confirmed tables promote the row divider to border-strong —
                    // the hairline "was never seen at all" (owner). See bodyStrong.
                    className={confirmedVariant ? idcStyles.table.bodyStrong : idcStyles.table.body}
                  >
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
                      inlineMeta={
                        <ResourceGroupCount
                          targetCount={group.targetCount}
                          excludedCount={group.excludedCount}
                        />
                      }
                      // Resource Name · Resource ID · Database Type · Region · 요청 대상 여부 ·
                      // 제외 사유 — the parent had a value for none of them once the identity
                      // took its type, region and counts (owner, 2026-08-12).
                      colSpan={6}
                    />
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
