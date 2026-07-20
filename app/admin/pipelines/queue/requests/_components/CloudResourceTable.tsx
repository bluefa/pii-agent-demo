/**
 * CloudResourceTable — P3 비-IDC (AWS 등) 연동 대상 리소스 (design-spec §3): app
 * res-tbl with Resource ID · Database Type · Region · 연동 대상 여부 · 제외 사유.
 * Excluded rows go grey (row-excluded) and their DB-type tag downgrades blue→gray.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { ResIdCell } from '@/app/admin/pipelines/queue/requests/_components/ResIdCell';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface CloudResourceTableProps {
  rows: RequestResourceRow[];
}

export function CloudResourceTable({ rows }: CloudResourceTableProps): ReactElement {
  const { appTable, tag } = tqStyles;
  return (
    <div className={appTable.wrap}>
      <table className={appTable.root}>
        <thead className={appTable.thead}>
          <tr>
            <th className={`${appTable.th} w-[120px] whitespace-nowrap`}>Database Type</th>
            <th className={appTable.th}>Resource ID</th>
            <th className={`${appTable.th} w-[140px]`}>Region</th>
            <th className={`${appTable.th} w-[130px]`}>연동 대상</th>
            <th className={`${appTable.th} w-[240px]`}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={appTable.body}>
          {rows.map((row, index) => (
            <tr
              key={row.resourceId ?? index}
              className={cn(appTable.row, !row.selected && appTable.rowExcluded)}
            >
              <td className={appTable.td}>
                <span className={cn(tag.base, row.selected ? tag.blue : tag.gray)}>
                  {row.databaseType ?? '—'}
                </span>
              </td>
              <td className={appTable.td}>
                {row.resourceId ? <ResIdCell value={row.resourceId} /> : <span className={appTable.tdMono}>—</span>}
              </td>
              <td className={`${appTable.td} ${appTable.tdMono}`}>{row.region ?? '—'}</td>
              <td className={appTable.td}>
                {row.selected ? (
                  <span className={appTable.targetYes}>연동 대상</span>
                ) : (
                  <span className={appTable.targetNo}>연동 대상 제외</span>
                )}
              </td>
              <td className={appTable.td}>
                {row.selected ? (
                  <span className="text-[var(--pl-text-weak)]">—</span>
                ) : (
                  <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">
                    {row.exclusionReason ?? '—'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
