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
import type { ReactElement } from 'react';
import { cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  DIM_TEXT,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
}

export function CloudResourceTable({ rows }: CloudResourceTableProps): ReactElement {
  const { table } = idcStyles;
  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME).
    <div className={CONNECTED_FRAME}>
      <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className={table.approvalHeader}>
          <tr>
            {/* Resource ID's text caps at 300px (resId.text), so its column was sitting
                on ~150px it could not use. Spent here: names differ in their TAIL
                (…-cluster-001 / -002), which is exactly what truncation eats first. */}
            <th className={cn(table.approvalHeaderCell, 'w-[360px]')}>Resource Name</th>
            <th className={table.approvalHeaderCell}>Resource ID</th>
            <th className={cn(table.approvalHeaderCell, 'w-[120px] whitespace-nowrap')}>Database Type</th>
            <th className={cn(table.approvalHeaderCell, 'w-[130px]')}>Region</th>
            <th className={cn(table.approvalHeaderCell, 'w-[100px]')}>연동 대상</th>
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
            const tone = excluded ? DIM_TEXT : textColors.secondary;
            return (
              <tr
                key={rowKey}
                className={cn(ROW_BASE, excluded ? ROW_EXCLUDED : ROW_TARGET)}
              >
                <td
                  className={cn(
                    table.approvalCell,
                    'font-mono text-[13px]',
                    excluded ? DIM_TEXT : textColors.primary,
                    // The row's anchor lifts to brand, marking which cell identifies it.
                    primaryColors.textGroupHover,
                  )}
                >
                  {/* One line, always — wrapping left row heights ragged. The full value
                      opens in the same tip card the rest of the app uses, and only when
                      the name is actually clipped (`truncatedOnly`). */}
                  <Tooltip
                    content={<IdentifierTip label="Resource Name" value={row.resourceName ?? ''} />}
                    variant="value"
                    size="md"
                    triggerClassName="block min-w-0 max-w-[360px]"
                    truncatedOnly
                  >
                    <span className="block truncate">{row.resourceName || '—'}</span>
                  </Tooltip>
                </td>
                <td className={table.approvalCell}>
                  {row.resourceId && (
                    <ResourceIdCell
                      value={row.resourceId}
                      label="Resource ID"
                      maxWidthClass="max-w-[300px]"
                      textClassName={cn(tone, CELL_LIFT)}
                    />
                  )}
                </td>
                <td className={cn(table.approvalCell, 'text-[12px]', tone, CELL_LIFT)}>
                  {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다. */}
                  {row.databaseType ? getDatabaseShortLabel(row.databaseType) : ''}
                </td>
                <td
                  className={cn(
                    table.approvalCell,
                    // A region is one token — wrapping it to "ap-northeast-" / "2" reads
                    // as two values.
                    'whitespace-nowrap font-mono text-[12px]',
                    tone,
                    CELL_LIFT,
                  )}
                >
                  {row.region}
                </td>
                <td className={cn(table.approvalCell, 'whitespace-nowrap text-[12px]', tone, CELL_LIFT)}>
                  {excluded ? '제외' : '대상'}
                </td>
                <td className={table.approvalCell}>
                  {/* A 대상 row has no reason to give — blank, not an em-dash, which
                      would read as "this should have had one and it is missing". The
                      chip clamps and the full sentence lives in its floating tip. */}
                  {excluded && row.exclusionReason && (
                    <ReasonChipInline
                      reason={row.exclusionReason}
                      summary={clampReason(row.exclusionReason)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
