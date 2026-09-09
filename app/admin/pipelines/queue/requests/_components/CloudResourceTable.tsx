'use client';

/**
 * CloudResourceTable — P3 비-IDC (AWS 등) 연동 대상 리소스.
 *
 * Wears the console grammar every resource table shares (`ConsoleTable`: the
 * `approvalHeaderFlat` header, a `table-fixed` column ledger, drag-resize, `consoleGrid`
 * rails, the covered-clip cell) and reuses the SERVICE OWNER'S ledger itself —
 * `APPROVAL_COLUMN_WIDTHS` / `APPROVAL_FLEX_KEYS` from `WaitingApprovalTable`, whose steps
 * 2·3 table asks these same six questions of these same rows. So the admin and the service
 * owner read one request through one design, down to the pixels each column gets, and the
 * shared ROW_* hover/lift tokens and ReasonChipInline carry the rest of it. Column order is
 * Step 2's: identity (name → id) → attributes (type · region) → decision (verdict → reason).
 *
 * The resize STORE is this screen's own key, not the owner's: a storage key names one
 * screen (repo rule), so a width dragged in the queue does not follow the requester home.
 *
 * The name column no longer carries its hand-set 360px. That width was bought with an
 * auto-layout argument — "Resource ID's text caps at 300px, so its column sits on ~150px it
 * cannot use, spend it on the name instead" — and auto layout is what left: under
 * `table-fixed` the ledger declares every width and `id` is the flex sink, so it absorbs all
 * the slack there is and there is no stranded width for the name column to rescue. The 300px
 * cap that stranded it goes too (the id cell switches to `hardClip`), for the same reason.
 *
 * Database Type carries no chip: it is a repeating attribute, not a status.
 *
 * Athena is a GROUP, not a run of rows (LIN-85): these are the very rows steps 2·3 group —
 * pre-approval, one per database — so one parent per (Athena × region) stands over its
 * databases here too, collapsed until opened, in the grammar `WaitingApprovalTable`'s approval
 * variant draws (`groupResourceRows` → `ResourceGroupRow` + the `table.group.*` rails). RDS
 * clusters and EC2 are untouched: grouping is Athena-keyed, and a cluster's members are a fold
 * inside one row, not a family of rows.
 *
 * ⛔ The page slice must arrive already folded into units (`toPaginationUnits`, done by
 * `ResourceSection`). Slicing rows flat cuts a group across the boundary and draws its parent
 * on both pages.
 */
import { Fragment, useState, type ReactElement } from 'react';
import { bgColors, cn, idcStyles, primaryColors, textColors, verdictRail } from '@/lib/theme';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { useClusterFold } from '@/app/hooks/useClusterFold';
import { useRailHover } from '@/app/hooks/useRailHover';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import {
  APPROVAL_COLUMN_WIDTHS,
  APPROVAL_FLEX_KEYS,
  CELL_LIFT,
  CONNECTED_FRAME,
  NAME_TEXT,
  NAME_TRIGGER,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import {
  GroupExclusionCount,
  ResourceGroupRow,
} from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceGroupRow';
import { RdsInstancePanel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
import {
  Ec2InstanceTag,
  RdsChosenInstanceLine,
  RdsClusterTag,
} from '@/app/components/ui/RdsInstanceChips';
import { isRdsCluster, sortRdsInstances } from '@/lib/rds-instances';
import { GROUPED_CHILD_KIND_LABEL, groupResourceRows } from '@/lib/resource-grouping';
import { isEc2Instance, resolveExclusionReason } from '@/lib/types';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
  /**
   * Force every group open while a search or filter narrows the list.
   *
   * Same contract as `WaitingApprovalTable`'s `expandFolds`, for the same failure: a row can
   * match on a database that is collapsed behind its region's chevron, and a shut group then
   * shows the user a region that does not visibly contain what they typed. The chevron goes
   * quiet with it — left live it does nothing visible AND records the press as a collapse, so
   * clearing the filter would shut a group the user had just opened.
   */
  expandGroups?: boolean;
}

/**
 * 두 admin 표가 같은 행 타입을 쓰므로 사유 셀도 한 군데서 푼다 — 스캔 판정 코드는 한국어
 * 한 줄로 서고 원문은 팁에만 남는다(`resolveExclusionReason`).
 */
export const ReasonChip = ({ row }: { row: RequestResourceRow }) => {
  const resolved = resolveExclusionReason(row.exclusionReason, row.recommendFailReason);
  if (!resolved) return null;
  return (
    <ReasonChipInline
      reason={resolved.text}
      summary={clampReason(resolved.text)}
      code={resolved.code}
    />
  );
};

/**
 * 열 원장 — 전부 `APPROVAL_COLUMN_WIDTHS` 그대로다(Σ 992 = 250+186+142+156+116+142).
 * 같은 여섯 질문을 같은 행에 던지는 표가 다른 눈금을 쓸 이유가 없어서, 폭 하나하나의
 * 근거는 저 원장 한 곳에만 적힌다.
 */
const CLOUD_COLUMNS: ConsoleTableColumn[] = [
  {
    key: 'name',
    label: 'Resource Name',
    width: APPROVAL_COLUMN_WIDTHS.name,
    flex: true,
    headClassName: idcStyles.table.nameCell,
  },
  // The sink: last flex column, so it takes what the others leave — the ARN, which every row
  // fills and which is the only value here a cut actually costs the reader.
  { key: 'id', label: 'Resource ID', width: APPROVAL_COLUMN_WIDTHS.id, flex: true },
  { key: 'dbType', label: 'Database Type', width: APPROVAL_COLUMN_WIDTHS.dbType },
  { key: 'region', label: 'Region', width: APPROVAL_COLUMN_WIDTHS.region },
  // The IDC table's wording for the same question. "연동 대상" named the verdict here while
  // it named the address column there — one table used the word for a row, the other for a
  // cell.
  { key: 'target', label: '요청 대상 여부', width: APPROVAL_COLUMN_WIDTHS.target },
  // Sized, not flex — see APPROVAL_FLEX_KEYS for the measurement that rejected it as the sink.
  { key: 'reason', label: '제외 사유', width: APPROVAL_COLUMN_WIDTHS.reason },
];

/**
 * One row with the key it renders under, computed over the WHOLE list before grouping reorders
 * it — a row with no `resource_id` keeps the index it arrived on rather than picking up its
 * position inside a group.
 */
interface KeyedRow {
  row: RequestResourceRow;
  rowKey: string;
}

export function CloudResourceTable({
  rows,
  expandGroups = false,
}: CloudResourceTableProps): ReactElement {
  const { table } = idcStyles;
  // Instance lists follow the shared fold policy (`useClusterFold`): open while the cluster is
  // part of the request, folded once it is excluded. The chevron overrides one cluster.
  const clusterFold = useClusterFold();
  // Tree rail: hovering any row of a group lights the whole rail, from whichever end.
  const railRow = useRailHover();
  // Which groups the user OPENED — closed is the default, so the empty set is the initial state
  // and no effect has to seed it. Held this way round for the reason `WaitingApprovalTable`
  // gives: a collapsed-by-default set would need re-seeding on every filter and page change,
  // and a group first appearing on page 2 would arrive open because nothing had put its key in.
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  // This screen's own store — the widths are shared with nothing, unlike the two cards the
  // service owner's steps 2·3 hang off one key.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:admin-cloud-resources',
    ephemeralKeys: APPROVAL_FLEX_KEYS,
  });

  const toggleGroup = (key: string) =>
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // Keyed on the top-level `resource_type`, exactly as steps 2·3 are (they read
  // `resource_type ?? metadata.database_type`) — the engine name is the fallback, never the
  // first answer, because an engine cannot say what KIND of resource a row is.
  const sections = groupResourceRows<KeyedRow>(
    // resource_id is optional in the contract; the index only stands in when the row
    // genuinely has no identity to key on.
    rows.map((row, index) => ({ row, rowKey: row.resourceId || `row-${index}` })),
    ({ row }) => ({
      type: row.resourceType ?? row.databaseType,
      region: row.region,
      selected: row.selected,
    }),
  );

  const renderRow = (
    { row, rowKey }: KeyedRow,
    grouped = false,
    lastInGroup = false,
    railKey?: string,
  ): ReactElement => {
    const excluded = !row.selected;
    // Resting tier is per cell, not per row: a row-level override would win over
    // the cells' own hover lifts and freeze excluded rows at the dim tier.
    const tone = textColors.secondary;
    // An RDS cluster connects through ONE member instance. Read-only here: the queue
    // reviews a submitted request, so the list shows what the cluster holds and which
    // instance the requester picked. Reader-first display order; the wire order is
    // the request's.
    //
    // The TAG keys on the declared type, as on every other review surface — a cluster
    // whose request predates the candidates field is still a cluster and must say so.
    // The LIST keys on candidates, because there is nothing to list without them.
    //
    // The list starts COLLAPSED, like every other surface (owner, 2026-09-04): the
    // collapsed parent's own ↳ line already names the chosen member, so opening by
    // default would spend rows repeating what that line already says.
    const isCluster = isRdsCluster(row.resourceType ?? '');
    const isEc2 = isEc2Instance(row.resourceType);
    const instances = sortRdsInstances(row.rdsInstanceCandidates);
    const hasInstances = instances.length > 0;
    // An excluded cluster submits no instance, so there is nothing chosen to name.
    const chosenInstance = instances.find(
      (instance) => instance.resource_id === row.selectedRdsInstanceResourceId,
    );
    const fold = clusterFold(rowKey, false);
    const instancesOpen = hasInstances && fold.open;
    // Only a group's child shares a rail with another ROW, so only it gets handlers:
    // this table is paginated, and lighting nothing on every pointer move would
    // re-render the list for a class with no effect. An open cluster is one such row —
    // its members are inside the accordion body now, which draws its own rail.
    const rail = grouped ? railRow(railKey ?? rowKey) : undefined;
    return (
      <Fragment key={rowKey}>
      {/* An open cluster row is the accordion's HEADER, so it wears the body's own
          surface: one tint across the two, nothing between them, and the pair reads as
          a row that opened instead of a panel that appeared under it. */}
      <tr
        className={cn(
          ROW_BASE,
          instancesOpen ? bgColors.panel : excluded ? ROW_EXCLUDED : ROW_TARGET,
          rail?.className,
        )}
        onMouseEnter={rail?.onMouseEnter}
        onMouseLeave={rail?.onMouseLeave}
      >
        <td
          className={cn(
            table.approvalCell,
            // The covered-clip cell (round 4): the CELL clips, so a long name cuts on
            // the column stroke instead of drawing its own ellipsis.
            table.consoleCell,
            // 그룹 자식은 열의 26px 들여쓰기 대신 트리 레일을 단다 — `childCell` 이
            // 54px 을 이미 주므로 두 padding 토큰이 한 셀에 같이 오면 안 된다.
            !grouped && table.nameCell,
            grouped && table.group.childCell,
            grouped && lastInGroup && table.group.childCellLast,
            // 14, the size WaitingApprovalTable and the IDC table give their own
            // identity column — it was rendering at the attribute tier.
            'font-mono text-[14px]',
            textColors.primary,
            // 제외는 자홍 레일을 달지 않는다 (오너, 2026-08-17) — IDC 표와 같은
            // 결정이다. 이 페이지의 두 표는 같은 승인 화면이므로 함께 움직인다.
            // 그룹 자식 행에서는 연동 불가 레일도 빠진다: 첫 셀 왼쪽은 트리 레일이
            // 이미 말하는 자리이고, 판정은 그 행의 요청 대상 여부 열과 부모 행의
            // 집계가 그대로 답한다(steps 2·3 과 같은 규칙).
            !grouped &&
              excluded &&
              row.integrationCategory === 'INSTALL_INELIGIBLE' &&
              verdictRail.ineligible,
            // The row's anchor lifts to brand, marking which cell identifies it.
            primaryColors.textGroupHover,
            // The rail's first segment runs from the chevron down into the open band;
            // without it the members' rail hangs off nothing.
            instancesOpen && table.group.parentCellNameAligned,
          )}
        >
          {/* One line, always — wrapping left row heights ragged. The full value
              opens in the same tip card the rest of the app uses, and only when
              the name is actually clipped (`truncatedOnly`). */}
          <span className={table.group.lead}>
            {hasInstances && (
              <button
                type="button"
                // No aria-controls: the band is unmounted while closed, so the
                // reference would dangle half the time — worse than the optional
                // attribute's absence (APG disclosure: aria-expanded alone conforms).
                aria-expanded={instancesOpen}
                aria-label={`${row.resourceName ?? ''} 인스턴스 목록 ${instancesOpen ? '접기' : '펼치기'}`}
                onClick={fold.toggle}
                className={cn(
                  table.group.toggleNameAligned,
                  instancesOpen ? table.group.toggleOpen : table.group.toggleClosed,
                  primaryColors.focusRing,
                )}
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <span className={cn(
              'flex w-full min-w-0 flex-col items-start gap-1',
              // Only a TWO-line row needs the lift — an untagged one is already on the
              // middle, and so is the name of a three-line cluster (tag → name → member).
              (isCluster || isEc2) && !hasInstances && table.stackedIdentityLift,
            )}>
            {isCluster && <RdsClusterTag />}
            {isEc2 && <Ec2InstanceTag />}
            <Tooltip
              content={<IdentifierTip label="Resource Name" value={row.resourceName ?? ''} />}
              variant="value"
              size="md"
              triggerClassName={NAME_TRIGGER}
              truncatedOnly
            >
              <span className={NAME_TEXT}>{row.resourceName || '—'}</span>
            </Tooltip>
            {/* Which member the request connects through — the same third line steps
                1·2·3 carry (owner, 2026-08-13). Hidden while the band is OPEN, on every
                surface — see the rule in `CandidateResourceRow`'s
                `showChosenInstanceLine`. */}
            {hasInstances && !instancesOpen && (
              <RdsChosenInstanceLine chosen={chosenInstance} total={instances.length} />
            )}
            </span>
          </span>
        </td>
        {/* Inside a group the id is dropped: it is the parent's own path with the
            child's name tacked on (`athena:<acct>:<region>:AwsDataCatalog/test_raw`),
            so every child repeated the group's identity and then said its name a
            second time. */}
        <td className={cn(table.approvalCell, table.consoleCell)}>
          {!grouped && row.resourceId && (
            // +18px = this cell's own right padding (approvalCell px-[18px]): the
            // wrapper must END at the column boundary, so the overlay copy button
            // anchors to the boundary rather than to a tail reserve. Same call the
            // service owner's table makes on the same value.
            <ResourceIdCell
              value={row.resourceId}
              label="Resource ID"
              maxWidthClass="w-[calc(100%+18px)]"
              sizeClass="text-[14px]"
              textClassName={cn(tone, CELL_LIFT)}
              hardClip
            />
          )}
        </td>
        <td
          className={cn(table.approvalCell, table.consoleCell, 'text-[14px]', tone, CELL_LIFT)}
        >
          {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다.
              그룹 안에서 이 열은 행이 무엇인지를 말한다 — 부모가 `Athena`, 자식이
              각각 `Database`. 열을 내려 읽으면 Athena → Database 가 된다. */}
          {grouped
            ? GROUPED_CHILD_KIND_LABEL
            : row.databaseType
              ? getDatabaseShortLabel(row.databaseType)
              : ''}
        </td>
        <td
          className={cn(
            table.approvalCell,
            table.consoleCell,
            // A region is one token — wrapping it to "ap-northeast-" / "2" reads
            // as two values.
            'whitespace-nowrap font-mono text-[14px]',
            tone,
            CELL_LIFT,
          )}
        >
          {row.region}
        </td>
        {/* The pill the IDC table and step 1 use, not a text label: the verdict
            is the same fact on every surface, and INSTALL_INELIGIBLE (the scan's
            judgement) must not read as a revisable 제외.
            No covered clip on this pair, as on the owner's own steps 2·3: the pill's
            longest word fits its column at every legal width, and the chip below
            clamps its own text. */}
        <td className={table.approvalCell}>
          <TargetPill
            excluded={excluded}
            ineligible={excluded && row.integrationCategory === 'INSTALL_INELIGIBLE'}
          />
        </td>
        <td className={cn(table.approvalCell, 'text-sm')}>
          {/* A 대상 row has no reason to give — blank, not an em-dash, which
              would read as "this should have had one and it is missing". The
              chip clamps and the full sentence lives in its floating tip. */}
          {excluded && <ReasonChip row={row} />}
        </td>
      </tr>
      {/* The member instances — rows of this table, in read-only mode, the same ones
          steps 1·2·3 open (owner, 2026-08-13). Everything the cluster answers for (id,
          verdict, reason) stays on the parent and those cells sit empty, exactly as a
          folded region's member rows leave them. Until 2026-09-03 this was a colspan
          band carrying a 3-column grid of its own, which put the AZ under the Resource
          ID column of the very table whose Region column it belongs in. */}
      {instancesOpen && (
        <RdsInstancePanel
          clusterId={rowKey}
          // `CLOUD_COLUMNS`, in order — the AZ goes under Region.
          columns={['name', 'blank', 'blank', 'availabilityZone', 'blank', 'blank']}
          instances={instances}
          chosenResourceId={row.selectedRdsInstanceResourceId ?? undefined}
          selectable={false}
          readonly
        />
      )}
      </Fragment>
    );
  };

  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME). The horizontal
    // scroll escape lives inside ConsoleTable's own wrapper.
    <div className={CONNECTED_FRAME}>
      <ConsoleTable columns={CLOUD_COLUMNS} resize={resize}>
        {/* One tbody per block — a group renders its parent and its children as separate
            bodies, which is also what lets the children hide as a unit while the parent's
            `aria-controls` keeps resolving. A list with no Athena in it yields exactly one
            block, so nothing about the flat table changed. */}
        {sections.map((section) => {
          if (section.kind === 'rows') {
            return (
              <tbody key={section.key} className={table.body}>
                {section.rows.map((entry) => renderRow(entry))}
              </tbody>
            );
          }

          const { group } = section;
          const rowsId = `cloud-group-${group.key.replace('|', '-')}`;
          // Closed unless the user opened it. The identity line already says how many
          // databases are inside and how many are excluded, so the rows underneath are what
          // you open to check that claim — not what you scroll past to reach the next group.
          const collapsed = !expandGroups && !expandedGroups.has(group.key);
          return (
            <Fragment key={group.key}>
              <tbody className={table.body}>
                <ResourceGroupRow
                  type={group.type}
                  region={group.region}
                  expanded={!collapsed}
                  onToggle={() => toggleGroup(group.key)}
                  toggleable={!expandGroups}
                  controls={rowsId}
                  rail={railRow(group.key)}
                  // A total with the exclusion taken off it — the one thing the columns cannot
                  // say, because it is about the group and not about any row in it. 요청 대상
                  // 여부 already answers 대상 for every child, so two parallel counts would say
                  // it twice (owner, 2026-08-23, on the identical row of steps 2·3).
                  inlineMeta={
                    <GroupExclusionCount
                      totalCount={group.targetCount + group.excludedCount}
                      excludedCount={group.excludedCount}
                    />
                  }
                  colSpan={CLOUD_COLUMNS.length}
                />
              </tbody>
              {/* Kept mounted while collapsed so `aria-controls` always resolves. */}
              <tbody id={rowsId} hidden={collapsed} className={table.body}>
                {group.rows.map((entry, index) =>
                  renderRow(entry, true, index === group.rows.length - 1, group.key),
                )}
              </tbody>
            </Fragment>
          );
        })}
      </ConsoleTable>
    </div>
  );
}
