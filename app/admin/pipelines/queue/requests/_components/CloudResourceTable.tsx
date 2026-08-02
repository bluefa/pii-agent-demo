/**
 * CloudResourceTable — P3 비-IDC (AWS 등) 연동 대상 리소스.
 *
 * Column order and cell grammar follow Step 2's approval table (the same request,
 * seen by the service owner): identity (name → id) → attributes (type · region) →
 * decision (verdict → reason). The scan anchor is the human-readable name, so it
 * leads and it is the cell that turns brand on row hover.
 *
 * Database Type carries no chip: it is a repeating attribute, not a status, and one
 * badge per row (the verdict) is enough — a second pill competes with it.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResIdCell } from '@/app/admin/pipelines/queue/requests/_components/ResIdCell';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
  /** Squares the top corners when a toolbar is attached above (P3). */
  wrapClassName?: string;
}

export function CloudResourceTable({ rows, wrapClassName }: CloudResourceTableProps): ReactElement {
  const { appTable, resTable } = tqStyles;
  return (
    <div className={cn(resTable.wrap, wrapClassName)}>
      <table className={resTable.root}>
        <thead className={resTable.thead}>
          <tr>
            {/* Resource ID's text caps at 300px (resId.text), so its column was sitting
                on ~150px it could not use. Spent here: names differ in their TAIL
                (…-cluster-001 / -002), which is exactly what truncation eats first. */}
            <th className={`${resTable.th} w-[340px]`}>Resource Name</th>
            <th className={resTable.th}>Resource ID</th>
            <th className={`${resTable.th} w-[120px] whitespace-nowrap`}>Database Type</th>
            <th className={`${resTable.th} w-[130px]`}>Region</th>
            <th className={`${resTable.th} w-[110px]`}>연동 대상</th>
            {/* Reasons are sentences ("스테이징 전용 인스턴스로 …"). 220px wrapped every
                one of them to three lines and left row heights ragged. */}
            <th className={`${resTable.th} w-[300px]`}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={resTable.body}>
          {rows.map((row, index) => {
            const excluded = !row.selected;
            // Resting tier is per cell, not per row: a row-level override would win over
            // the cells' own hover lifts and freeze excluded rows at the dim tier.
            const restTone = excluded ? appTable.cellDim : undefined;
            return (
              <tr
                key={row.resourceId ?? index}
                className={excluded ? appTable.rowExcluded : appTable.rowApproval}
              >
                <td
                  className={cn(
                    resTable.td,
                    appTable.tdMonoBare,
                    restTone ?? 'text-[var(--pl-text-strong)]',
                    appTable.cellLiftName,
                  )}
                >
                  {/* One line, always. Wrapping turned the row's anchor column into a
                      2–3 line block and left row heights ragged; the full name is in
                      the title tip. */}
                  <span className="block max-w-[340px] truncate" title={row.resourceName ?? undefined}>
                    {row.resourceName}
                  </span>
                </td>
                <td className={resTable.td}>
                  {row.resourceId && (
                    <ResIdCell
                      value={row.resourceId}
                      textClassName={cn(
                        restTone ?? 'text-[var(--pl-text-medium)]',
                        appTable.cellLift,
                      )}
                    />
                  )}
                </td>
                <td
                  className={cn(
                    resTable.td,
                    'text-[12px]',
                    restTone ?? 'text-[var(--pl-text-medium)]',
                    appTable.cellLift,
                  )}
                >
                  {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다. */}
                  {row.databaseType ? getDatabaseShortLabel(row.databaseType) : ''}
                </td>
                <td
                  className={cn(
                    resTable.td,
                    appTable.tdMonoBare,
                    // A region is one token — wrapping it to "ap-northeast-" / "2" reads
                    // as two values.
                    'whitespace-nowrap',
                    restTone ?? 'text-[var(--pl-text-medium)]',
                    appTable.cellLift,
                  )}
                >
                  {row.region}
                </td>
                <td
                  className={cn(
                    resTable.td,
                    appTable.targetText,
                    restTone ?? 'text-[var(--pl-text-medium)]',
                    appTable.cellLift,
                  )}
                >
                  {excluded ? '제외' : '대상'}
                </td>
                <td
                  className={cn(
                    resTable.td,
                    'text-[12px] font-normal',
                    excluded ? appTable.cellDim : 'text-[var(--pl-text-faint)]',
                    excluded && appTable.cellLift,
                  )}
                >
                  {/* A 대상 row has no reason to give — blank, not an em-dash, which
                      would read as "this should have had one and it is missing". */}
                  {excluded && row.exclusionReason}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
