'use client';

/**
 * Test Connection 이력 card — the Complete / Reject / Reset trail
 * (GET …/test-connection/history, Spring-paged, newest first).
 *
 * The status enum is rendered through a small tone map; an unmapped value shows
 * the raw wire string on a neutral tag rather than being folded into a known state.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getTestConnectionHistory, type TcHistoryRow } from '@/app/lib/api/task-queue-tc';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TC_TONE_FILL,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

const PAGE_SIZE = 5;

const STATUS_META: Record<string, { tone: TcTone; label: string }> = {
  COMPLETE: { tone: 'ok', label: '완료' },
  REJECT: { tone: 'err', label: '재실행 요청' },
  RESET: { tone: 'warn', label: '초기화' },
};

export interface TcHistoryCardProps {
  targetSourceId: number;
  /** Bumped by the tab — a 재실행 요청 / 승인 adds a row to this trail. */
  reloadKey: number;
}

export function TcHistoryCard({ targetSourceId, reloadKey }: TcHistoryCardProps): ReactElement {
  const [rows, setRows] = useState<TcHistoryRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${targetSourceId}:${reloadKey}:${page}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTestConnectionHistory(targetSourceId, page, PAGE_SIZE);
        if (cancelled) return;
        setRows(data.content);
        setTotalPages(data.totalPages);
        setFailed(false);
      } catch {
        if (cancelled) return;
        setRows([]);
        setTotalPages(1);
        setFailed(true);
      }
      if (!cancelled) setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, loadKey]);

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="Test Connection 이력">
      <h2 className={opsStyles.cardTitle}>Test Connection 이력</h2>
      <p className={opsStyles.cardDesc}>완료 · 재실행 요청 · 초기화 기록 (최신순)</p>

      {loading ? (
        <div className="min-h-[160px]" aria-busy />
      ) : failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>이력을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="clock" message="이력이 없습니다." className="mt-2" />
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          <table className={table.base}>
            <thead>
              <tr>
                <th className={table.headCell}>일시</th>
                <th className={table.headCell}>상태</th>
                <th className={table.headCell}>사유</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {rows.map((row, index) => {
                const meta = STATUS_META[row.status];
                return (
                  <tr key={`${row.createdAt ?? 'row'}-${index}`}>
                    <td className={cn(table.cell, 'whitespace-nowrap')}>
                      {fmtDateTime(row.createdAt)}
                    </td>
                    <td className={table.cell}>
                      <span
                        className={cn(
                          opsStyles.statusTag,
                          TC_TONE_FILL[meta ? meta.tone : 'off'],
                        )}
                      >
                        {meta ? meta.label : row.status}
                      </span>
                    </td>
                    <td className={table.cell}>{row.reason || <Dash />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}
