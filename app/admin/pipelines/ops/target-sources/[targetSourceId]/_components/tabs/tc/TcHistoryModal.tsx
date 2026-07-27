'use client';

/**
 * Test Connection 이력 modal — the Complete / Reject / Reset trail
 * (GET …/test-connection/history, Spring-paged, newest first), opened from the
 * 결과 card's 이력 확인 header CTA. Mounted per open, so every open starts on
 * page 0 with a fresh fetch; writes cannot happen while the overlay is up.
 *
 * Presentation mirrors the sibling LdbModal grammar: tqStyles.appTable rows in
 * a task-width shell with PlPagination below — the full trail is reachable
 * page by page. An unmapped status renders its raw wire string on a neutral
 * tag rather than being folded into a known state.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { getTestConnectionHistory, type TcHistoryRow } from '@/app/lib/api/task-queue-tc';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TC_TONE_FILL,
  type TcTone,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

const PAGE_SIZE = 5;
const TITLE_ID = 'ops-tc-history-title';

const STATUS_META: Record<string, { tone: TcTone; label: string }> = {
  TEST_CONNECTION_COMPLETED: { tone: 'ok', label: '완료' },
  TEST_CONNECTION_REJECTED: { tone: 'err', label: '재실행 요청' },
  TEST_CONNECTION_RESET: { tone: 'warn', label: '초기화' },
};

export interface TcHistoryModalProps {
  targetSourceId: number;
  onClose: () => void;
}

export function TcHistoryModal({ targetSourceId, onClose }: TcHistoryModalProps): ReactElement {
  const [rows, setRows] = useState<TcHistoryRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${targetSourceId}:${page}`;
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

  const { appTable } = tqStyles;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Test Connection 이력
      </h3>
      <p className={pipelineStyles.modal.desc}>완료 · 재실행 요청 · 초기화 이벤트의 전체 기록 (최신순)</p>

      {loading ? (
        <div className="min-h-[220px]" aria-busy />
      ) : failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>이력을 불러오지 못했습니다.</p>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="clock" message="이력이 없습니다." className="mt-2" />
      ) : (
        <div className={appTable.wrap}>
          <table className={appTable.root}>
            <thead className={appTable.thead}>
              <tr>
                <th className={cn(appTable.th, 'w-[150px]')}>일시</th>
                <th className={cn(appTable.th, 'w-[110px]')}>상태</th>
                <th className={appTable.th}>사유</th>
              </tr>
            </thead>
            <tbody className={appTable.body}>
              {rows.map((row, index) => {
                const meta = STATUS_META[row.status];
                return (
                  <tr key={`${row.createdAt ?? 'row'}-${index}`}>
                    <td className={cn(appTable.td, 'whitespace-nowrap text-[13px]')}>
                      {fmtDateTime(row.createdAt)}
                    </td>
                    <td className={appTable.td}>
                      <span
                        className={cn(
                          opsStyles.statusTag,
                          TC_TONE_FILL[meta ? meta.tone : 'off'],
                        )}
                      >
                        {meta ? meta.label : row.status}
                      </span>
                    </td>
                    <td className={cn(appTable.td, 'text-[13px] break-keep')}>
                      {row.reason || <Dash />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !failed && totalPages > 1 && (
        <PlPagination
          className="mt-4"
          center
          page={page + 1}
          pages={totalPages}
          onPrev={() => setPage((n) => Math.max(0, n - 1))}
          onNext={() => setPage((n) => Math.min(totalPages - 1, n + 1))}
        />
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
