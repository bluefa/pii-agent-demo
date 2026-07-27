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
  TC_TONE_FILL,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

const PAGE_SIZE = 5;

const STATUS_META: Record<string, { tone: TcTone; label: string }> = {
  TEST_CONNECTION_COMPLETED: { tone: 'ok', label: '완료' },
  TEST_CONNECTION_REJECTED: { tone: 'err', label: '재실행 요청' },
  TEST_CONNECTION_RESET: { tone: 'warn', label: '초기화' },
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

  // A write adds a newest-first row — jump back to page 0 so it is visible.
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey);
  if (reloadKey !== prevReloadKey) {
    setPrevReloadKey(reloadKey);
    setPage(0);
  }

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

  return (
    <section aria-label="Test Connection 이력">
      <h2 className={opsStyles.cardTitle}>이력</h2>
      <p className={opsStyles.cardDesc}>완료 · 재실행 · 초기화 (최신순)</p>

      {loading ? (
        <div className="min-h-[160px]" aria-busy />
      ) : failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>이력을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="clock" message="이력이 없습니다." className="mt-2" />
      ) : (
        /* The 300px side rail cannot hold a 3-column table — stacked entries
           (tag + datetime row, then wrapping reason) keep everything readable. */
        <ul className="mt-2 flex flex-col text-[13px]">
          {rows.map((row, index) => {
            const meta = STATUS_META[row.status];
            return (
              <li
                key={`${row.createdAt ?? 'row'}-${index}`}
                className="flex flex-col gap-1.5 py-3 border-b border-[var(--pl-gray-100)] last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      opsStyles.statusTag,
                      TC_TONE_FILL[meta ? meta.tone : 'off'],
                    )}
                  >
                    {meta ? meta.label : row.status}
                  </span>
                  <span className="text-[12px] text-[var(--pl-text-weak)] whitespace-nowrap tabular-nums">
                    {fmtDateTime(row.createdAt)}
                  </span>
                </div>
                {row.reason && (
                  <p className="text-[12px] leading-[1.5] text-[var(--pl-text-medium)] break-keep">
                    {row.reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
    </section>
  );
}
