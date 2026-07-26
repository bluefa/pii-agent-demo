'use client';

/**
 * 상태 변경 이력 card (Figma 30:3 right) — Step N → Step M transition log.
 * ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §1 (no backing endpoint
 * in install-v1.yaml yet; the Next route serves a mock).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getStatusHistory, type StatusHistoryItem } from '@/app/lib/api/ops';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { fmtDateTime } from '@/lib/pipeline/format';
import { StepPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StepPill';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 5;

export interface StatusHistoryCardProps {
  targetSourceId: number;
}

export function StatusHistoryCard({ targetSourceId }: StatusHistoryCardProps): ReactElement {
  const [rows, setRows] = useState<StatusHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (nextPage: number): Promise<void> => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await getStatusHistory(targetSourceId, nextPage, PAGE_SIZE);
      setRows(data.content ?? []);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setPage(nextPage);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void load(0);
  }, [load]);

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="상태 변경 이력">
      <h2 className={opsStyles.cardTitle}>상태 변경 이력</h2>

      {failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>상태 변경 이력을 불러오지 못했습니다.</p>
      ) : !loading && rows.length === 0 ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>상태 변경 이력이 없습니다.</p>
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          {/* Figma 4:2: two columns only (일시 · 변경) — no actor column. */}
          <table className={table.base}>
            <thead>
              <tr>
                <th className={table.headCell}>일시</th>
                <th className={table.headCell}>변경</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {rows.map((row, index) => (
                <tr key={`${row.changed_at}-${index}`}>
                  <td className={cn(table.cell, 'whitespace-nowrap')}>
                    {fmtDateTime(row.changed_at)}
                  </td>
                  <td className={table.cell}>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.from_status && (
                        <>
                          <StepPill status={row.from_status} />
                          <span className="text-[var(--pl-text-weak)]" aria-hidden>→</span>
                        </>
                      )}
                      <StepPill status={row.to_status} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsPagination page={page} totalPages={totalPages} onChange={(next) => void load(next)} />
    </section>
  );
}
