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
  const { appTable } = tqStyles;
  return (
    <div className={cn(appTable.wrap, wrapClassName)}>
      <table className={appTable.root}>
        <thead className={appTable.thead}>
          <tr>
            {/* Resource ID's text caps at 300px (resId.text), so its column was sitting
                on ~150px it could not use. Spent here: names differ in their TAIL
                (…-cluster-001 / -002), which is exactly what truncation eats first. */}
            <th className={`${appTable.th} w-[340px]`}>Resource Name</th>
            <th className={appTable.th}>Resource ID</th>
            <th className={`${appTable.th} w-[120px] whitespace-nowrap`}>Database Type</th>
            <th className={`${appTable.th} w-[130px]`}>Region</th>
            <th className={`${appTable.th} w-[110px]`}>연동 대상</th>
            {/* Reasons are sentences ("스테이징 전용 인스턴스로 …"). 220px wrapped every
                one of them to three lines and left row heights ragged. */}
            <th className={`${appTable.th} w-[300px]`}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={appTable.body}>
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
                    appTable.tdBare,
                    appTable.tdMonoBare,
                    restTone ?? 'text-[var(--pl-text-strong)]',
                    appTable.cellLiftName,
                  )}
                >
                  {/* One line, always. Wrapping turned the row's anchor column into a
                      2–3 line block and left row heights ragged; the full name is in
                      the title tip. */}
                  <span className="block max-w-[340px] truncate" title={row.resourceName ?? undefined}>
                    {row.resourceName ?? '—'}
                  </span>
                </td>
                <td className={appTable.tdBare}>
                  {row.resourceId ? (
                    <ResIdCell
                      value={row.resourceId}
                      textClassName={cn(
                        restTone ?? 'text-[var(--pl-text-medium)]',
                        appTable.cellLift,
                      )}
                    />
                  ) : (
                    <span className={cn(appTable.tdMonoBare, appTable.cellDim)}>—</span>
                  )}
                </td>
                <td
                  className={cn(
                    appTable.tdBare,
                    'text-[12px]',
                    restTone ?? 'text-[var(--pl-text-medium)]',
                    appTable.cellLift,
                  )}
                >
                  {/* wire 는 소문자 원문(mysql·athena)이라 사용자 화면과 같은 표기로 맞춘다. */}
                  {row.databaseType ? getDatabaseShortLabel(row.databaseType) : '—'}
                </td>
                <td
                  className={cn(
                    appTable.tdBare,
                    appTable.tdMonoBare,
                    restTone ?? 'text-[var(--pl-text-medium)]',
                    appTable.cellLift,
                  )}
                >
                  {row.region ?? '—'}
                </td>
                <td className={appTable.tdBare}>
                  {excluded ? (
                    <span className={appTable.targetNo}>연동 대상 제외</span>
                  ) : (
                    <span className={appTable.targetYes}>연동 대상</span>
                  )}
                </td>
                <td
                  className={cn(
                    appTable.tdBare,
                    'text-[12px] font-normal',
                    excluded ? appTable.cellDim : 'text-[var(--pl-text-faint)]',
                    excluded && appTable.cellLift,
                  )}
                >
                  {excluded ? row.exclusionReason ?? '—' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
