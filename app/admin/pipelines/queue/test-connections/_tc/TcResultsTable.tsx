/**
 * P5 연결 테스트 결과 table (`.res-tbl`, design-spec §5) — one row per resource:
 * Database Type · Resource ID (copy) · 연동 대상 · 연동 대상 논리 DB (drill link) ·
 * 연동 제외 논리 DB (drill link) · Connection Status. Failed rows render "—" for the
 * two logical-DB counts (no link). Uses the app-table grammar in tqStyles.appTable.
 */
import { useCallback, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { ldbCount, type LdbTab } from '@/app/admin/pipelines/queue/test-connections/_tc/logic';

export interface TcResultsTableProps {
  rows: readonly TcResultRow[];
  onOpenLdb: (resourceId: string, tab: LdbTab) => void;
}

export function TcResultsTable({ rows, onOpenLdb }: TcResultsTableProps): ReactElement {
  const { appTable, tag } = tqStyles;

  const copy = useCallback((value: string) => {
    void navigator.clipboard?.writeText(value);
  }, []);

  return (
    <div className={appTable.wrap}>
      <table className={appTable.root}>
        <thead className={appTable.thead}>
          <tr>
            <th className={cn(appTable.th, 'w-[104px]')}>Database Type</th>
            <th className={appTable.th}>Resource ID</th>
            <th className={appTable.th}>연동 대상</th>
            <th className={cn(appTable.th, 'w-[120px]')}>연동 대상 논리 DB</th>
            <th className={cn(appTable.th, 'w-[120px]')}>연동 제외 논리 DB</th>
            <th className={cn(appTable.th, 'w-[120px]')}>Connection Status</th>
          </tr>
        </thead>
        <tbody className={appTable.body}>
          {rows.map((row) => {
            const inc = ldbCount(row, 'inc');
            const exc = ldbCount(row, 'exc');
            const failed = row.connectionStatus === 'FAILED';
            return (
              <tr key={row.resourceId} className={appTable.row}>
                <td className={appTable.td}>
                  {row.databaseType ? (
                    <span className={cn(tag.base, tag.blue)}>{row.databaseType}</span>
                  ) : (
                    <span className="text-[var(--pl-text-faint)]">—</span>
                  )}
                </td>
                <td className={appTable.td}>
                  <span className={appTable.resId.cell}>
                    <span className={appTable.resId.text} title={row.resourceId}>
                      {row.resourceId || '—'}
                    </span>
                    {row.resourceId && (
                      <button
                        type="button"
                        className={appTable.resId.copy}
                        aria-label="Resource ID 복사"
                        onClick={() => copy(row.resourceId)}
                      >
                        <Icon name="copy" size="sm" />
                      </button>
                    )}
                  </span>
                </td>
                <td className={cn(appTable.td, appTable.tdMono)}>
                  {row.connectionTarget || '—'}
                </td>
                <td className={appTable.td}>{countCell(inc, () => onOpenLdb(row.resourceId, 'inc'))}</td>
                <td className={appTable.td}>{countCell(exc, () => onOpenLdb(row.resourceId, 'exc'))}</td>
                <td className={appTable.td}>
                  <span className={cn(tag.base, failed ? tag.red : tag.green)}>
                    {failed ? 'Failed' : 'Success'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A count as a drill-down link, or "—" when the row failed (count === null). */
function countCell(count: number | null, onOpen: () => void): ReactElement {
  if (count === null) return <span className="text-[var(--pl-text-faint)]">—</span>;
  return (
    <button type="button" className={tqStyles.appTable.ldbLink} onClick={onOpen}>
      {count}
    </button>
  );
}
