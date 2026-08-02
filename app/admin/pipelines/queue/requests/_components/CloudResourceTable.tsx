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
import {
  CELL_LIFT,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { ResIdCell } from '@/app/admin/pipelines/queue/requests/_components/ResIdCell';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
  /** Squares the top corners when a toolbar is attached above (P3). */
  wrapClassName?: string;
}

/** Excluded rows REST one tier dimmer; the hover lift restores full contrast. */
const DIM = 'text-[#6B7280]';

export function CloudResourceTable({ rows, wrapClassName }: CloudResourceTableProps): ReactElement {
  const { table } = idcStyles;
  return (
    <div className={cn(table.frame, wrapClassName)}>
      <table className="w-full">
        <thead className={table.header}>
          <tr>
            {/* Resource ID's text caps at 300px (resId.text), so its column was sitting
                on ~150px it could not use. Spent here: names differ in their TAIL
                (…-cluster-001 / -002), which is exactly what truncation eats first. */}
            <th className={cn(table.headerCell, 'w-[360px]')}>Resource Name</th>
            <th className={table.headerCell}>Resource ID</th>
            <th className={cn(table.headerCell, 'w-[120px] whitespace-nowrap')}>Database Type</th>
            <th className={cn(table.headerCell, 'w-[130px]')}>Region</th>
            <th className={cn(table.headerCell, 'w-[110px]')}>연동 대상</th>
            <th className={cn(table.headerCell, 'w-[220px]')}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={table.body}>
          {rows.map((row, index) => {
            const excluded = !row.selected;
            // Resting tier is per cell, not per row: a row-level override would win over
            // the cells' own hover lifts and freeze excluded rows at the dim tier.
            const tone = excluded ? DIM : textColors.secondary;
            return (
              <tr
                key={row.resourceId ?? index}
                className={cn(ROW_BASE, excluded ? ROW_EXCLUDED : ROW_TARGET)}
              >
                <td
                  className={cn(
                    table.cell,
                    'font-mono text-[13px]',
                    excluded ? DIM : textColors.primary,
                    // The row's anchor lifts to brand, marking which cell identifies it.
                    primaryColors.textGroupHover,
                  )}
                >
                  {/* One line, always. Wrapping turned the row's anchor column into a
                      2–3 line block and left row heights ragged; the full name is in
                      the title tip. */}
                  <span className="block max-w-[360px] truncate" title={row.resourceName ?? undefined}>
                    {row.resourceName}
                  </span>
                </td>
                <td className={table.cell}>
                  {row.resourceId && (
                    <ResIdCell value={row.resourceId} textClassName={cn(tone, CELL_LIFT)} />
                  )}
                </td>
                <td className={cn(table.cell, 'text-[12px]', tone, CELL_LIFT)}>
                  {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다. */}
                  {row.databaseType ? getDatabaseShortLabel(row.databaseType) : ''}
                </td>
                <td
                  className={cn(
                    table.cell,
                    // A region is one token — wrapping it to "ap-northeast-" / "2" reads
                    // as two values.
                    'whitespace-nowrap font-mono text-[12px]',
                    tone,
                    CELL_LIFT,
                  )}
                >
                  {row.region}
                </td>
                <td className={cn(table.cell, 'whitespace-nowrap text-[12px]', tone, CELL_LIFT)}>
                  {excluded ? '제외' : '대상'}
                </td>
                <td className={table.cell}>
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
  );
}
