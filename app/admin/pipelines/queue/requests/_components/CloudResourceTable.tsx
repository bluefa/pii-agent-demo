'use client';

/**
 * CloudResourceTable — P3 비-IDC (AWS 등) 연동 대상 리소스.
 *
 * Uses the app-side approval table itself — `idcStyles.table` chrome, the shared
 * ROW_* hover/lift tokens and ReasonChipInline — so the admin and the service owner
 * read one request through one design. Column order is Step 2's: identity (name →
 * id) → attributes (type · region) → decision (verdict → reason).
 *
 * Database Type carries no chip: it is a repeating attribute, not a status.
 */
import { Fragment, type ReactElement } from 'react';
import { bgColors, cn, idcStyles, primaryColors, textColors, verdictRailClass } from '@/lib/theme';
import { useClusterFold } from '@/app/hooks/useClusterFold';
import { ChevronRightIcon } from '@/app/components/ui/icons';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { RdsInstancePanel } from '@/app/target-sources/[targetSourceId]/_components/shared/RdsInstancePanel';
import {
  Ec2InstanceTag,
  RdsChosenInstanceLine,
  RdsClusterTag,
} from '@/app/components/ui/RdsInstanceChips';
import { isRdsCluster, sortRdsInstances } from '@/lib/rds-instances';
import { isEc2Instance, resolveExclusionReason } from '@/lib/types';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
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

export function CloudResourceTable({ rows }: CloudResourceTableProps): ReactElement {
  const { table } = idcStyles;
  // Instance lists follow the shared fold policy (`useClusterFold`): open while the cluster is
  // part of the request, folded once it is excluded. The chevron overrides one cluster.
  const clusterFold = useClusterFold();
  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME).
    <div className={CONNECTED_FRAME}>
      <div className="overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead className={table.approvalHeaderChrome}>
          <tr>
            {/* Resource ID's text caps at 300px (resId.text), so its column was sitting
                on ~150px it could not use. Spent here: names differ in their TAIL
                (…-cluster-001 / -002), which is exactly what truncation eats first. */}
            <th className={cn(table.approvalHeaderCell, table.nameCell, 'w-[360px]')}>Resource Name</th>
            <th className={table.approvalHeaderCell}>Resource ID</th>
            <th className={cn(table.approvalHeaderCell, 'w-[120px] whitespace-nowrap')}>Database Type</th>
            <th className={cn(table.approvalHeaderCell, 'w-[130px]')}>Region</th>
            {/* The IDC table's wording and width for the same question. "연동 대상" named
                the verdict here while it named the address column there — one table used
                the word for a row, the other for a cell. 112 is what the pill needs. */}
            <th className={cn(table.approvalHeaderCell, 'w-[112px] whitespace-nowrap')}>요청 대상 여부</th>
            <th className={cn(table.approvalHeaderCell, 'w-[240px]')}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={table.body}>
          {rows.map((row, index) => {
            const excluded = !row.selected;
            // resource_id is optional in the contract; the index only stands in when
            // the row genuinely has no identity to key on.
            const rowKey = row.resourceId || `row-${index}`;
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
            const isCluster = isRdsCluster(row.resourceType ?? '');
            const isEc2 = isEc2Instance(row.resourceType);
            const instances = sortRdsInstances(row.rdsInstanceCandidates);
            const hasInstances = instances.length > 0;
            // An excluded cluster submits no instance, so there is nothing chosen to name.
            const chosenInstance = instances.find(
              (instance) => instance.resource_id === row.selectedRdsInstanceResourceId,
            );
            const fold = clusterFold(rowKey, row.selected);
            const instancesOpen = hasInstances && fold.open;
            return (
              <Fragment key={rowKey}>
              {/* No rail-hover handlers: the members are inside the accordion body now, which
                  draws its own rail, so there is no second ROW for a hover to light with this
                  one — and a handler on every row re-renders the table for nothing.

                  An open cluster row is the accordion's HEADER, so it wears the body's own
                  surface: one tint across the two, nothing between them, and the pair reads as
                  a row that opened instead of a panel that appeared under it. */}
              <tr
                className={cn(
                  ROW_BASE,
                  instancesOpen ? bgColors.panel : excluded ? ROW_EXCLUDED : ROW_TARGET,
                )}
              >
                <td
                  className={cn(
                    table.approvalCell,
                    table.nameCell,
                    // 14, the size WaitingApprovalTable and the IDC table give their own
                    // identity column — it was rendering at the attribute tier.
                    'font-mono text-[14px]',
                    textColors.primary,
                    verdictRailClass(excluded, excluded && row.integrationCategory === 'INSTALL_INELIGIBLE'),
                    // The row's anchor lifts to brand, marking which cell identifies it.
                    primaryColors.textGroupHover,
                    // The rail's first segment runs from the chevron down into the open band;
                    // without it the members' rail hangs off nothing.
                    instancesOpen && table.group.parentCell,
                  )}
                >
                  {/* One line, always — wrapping left row heights ragged. The full value
                      opens in the same tip card the rest of the app uses, and only when
                      the name is actually clipped (`truncatedOnly`). */}
                  <span className={table.group.lead}>
                    {hasInstances && (
                      <button
                        type="button"
                        // No aria-controls: the instance rows are `<tr>` siblings with no
                        // single element to point at (APG disclosure: aria-expanded alone
                        // is conforming).
                        aria-expanded={instancesOpen}
                        aria-label={`${row.resourceName ?? ''} 인스턴스 목록 ${instancesOpen ? '접기' : '펼치기'}`}
                        onClick={fold.toggle}
                        className={cn(
                          table.group.toggle,
                          instancesOpen ? table.group.toggleOpen : table.group.toggleClosed,
                          primaryColors.focusRing,
                        )}
                      >
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className={cn(
                      'flex min-w-0 flex-col items-start gap-1',
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
                      triggerClassName="block min-w-0 max-w-[360px]"
                      truncatedOnly
                    >
                      <span className="block truncate">{row.resourceName || '—'}</span>
                    </Tooltip>
                    {/* Which member the request connects through — the same third line steps
                        1·2·3 carry (owner, 2026-08-13). The queue exists to check that choice,
                        so folding the band away must not be what deletes it. */}
                    {hasInstances && (
                      <RdsChosenInstanceLine chosen={chosenInstance} total={instances.length} />
                    )}
                    </span>
                  </span>
                </td>
                <td className={table.approvalCell}>
                  {row.resourceId && (
                    <ResourceIdCell
                      value={row.resourceId}
                      label="Resource ID"
                      maxWidthClass="max-w-[300px]"
                      sizeClass="text-[14px]"
                      textClassName={cn(tone, CELL_LIFT)}
                    />
                  )}
                </td>
                <td className={cn(table.approvalCell, 'text-[14px]', tone, CELL_LIFT)}>
                  {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다. */}
                  {row.databaseType ? getDatabaseShortLabel(row.databaseType) : ''}
                </td>
                <td
                  className={cn(
                    table.approvalCell,
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
                    judgement) must not read as a revisable 제외. */}
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
              {/* The member instances — the app's own accordion body in read-only mode, the
                  same one steps 1·2·3 open (owner, 2026-08-13). Everything the cluster answers
                  for (id, verdict, reason) stays on the parent, which is exactly why they are
                  not rows of this table: half its columns were the cluster's single decision
                  and sat blank on every member, the endpoint had no column at all, and the AZ
                  was filed under the Region header for want of anywhere else to put it. */}
              {instancesOpen && (
                <RdsInstancePanel
                  clusterId={rowKey}
                  showCheckboxColumn={false}
                  colSpan={6}
                  instances={instances}
                  chosenResourceId={row.selectedRdsInstanceResourceId ?? undefined}
                  selectable={false}
                  readonly
                />
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
