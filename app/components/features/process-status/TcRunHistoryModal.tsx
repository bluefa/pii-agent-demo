'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTestConnectionExecutionHistory,
  type TcExecutionPage,
  type TcExecutionStatus,
} from '@/app/lib/api/task-queue-tc';
import { tcElapsedLabel } from '@/lib/test-connection-summary';

const PAGE_SIZE = 10;

const STATUS_TAG: Record<TcExecutionStatus, { className: string; label: string }> = {
  SUCCESS: { className: idcStyles.tag.green, label: '성공' },
  FAIL: { className: idcStyles.tag.red, label: '실패' },
  RUNNING: { className: idcStyles.tag.orange, label: '진행 중' },
  PENDING: { className: idcStyles.tag.gray, label: '대기' },
  UNKNOWN: { className: idcStyles.tag.gray, label: '미확인' },
};

interface TcRunHistoryModalProps {
  open: boolean;
  targetSourceId: number;
  onClose: () => void;
}

/**
 * 실행 이력 (GET …/test-connection/execution-history) — 회차·판정·시각·소요만.
 * 계약이 주는 것이 그 네 가지뿐이라 표도 거기서 멈춘다 (회차 클릭 드릴다운 없음).
 */
export const TcRunHistoryModal = ({ open, targetSourceId, onClose }: TcRunHistoryModalProps) => {
  const [page, setPage] = useState(0);
  // Fetched pages are keyed by their page number; the current page missing from the
  // cache IS the loading state — no sync setState inside the effect.
  const [pages, setPages] = useState<Record<number, TcExecutionPage | 'error'>>({});

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getTestConnectionExecutionHistory(targetSourceId, page, PAGE_SIZE)
      .then((data) => {
        if (active) setPages((prev) => ({ ...prev, [page]: data }));
      })
      .catch(() => {
        if (active) setPages((prev) => ({ ...prev, [page]: 'error' }));
      });
    return () => {
      active = false;
    };
  }, [open, targetSourceId, page]);

  // Closing resets to the newest page and drops the cache so reopening re-reads —
  // a run may have finished since.
  const handleClose = () => {
    setPage(0);
    setPages({});
    onClose();
  };

  const current = pages[page];
  const state:
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; data: TcExecutionPage } =
    current === undefined
      ? { status: 'loading' }
      : current === 'error'
        ? { status: 'error' }
        : { status: 'ready', data: current };

  const totalPages = state.status === 'ready' ? state.data.totalPages : 1;

  return (
    <Modal isOpen={open} onClose={handleClose} title="연결 테스트 실행 이력" size="lg" chrome="toss-compact">
      <div className="space-y-3">
        {state.status === 'loading' && (
          <p className={cn('py-6 text-center text-[14px]', textColors.tertiary)}>불러오는 중...</p>
        )}
        {state.status === 'error' && (
          <p className={cn('py-6 text-center text-[14px]', textColors.tertiary)}>
            실행 이력을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}
        {state.status === 'ready' && (
          <>
            <table className="w-full">
              <thead className={idcStyles.table.approvalHeader}>
                <tr className="whitespace-nowrap">
                  <th className={idcStyles.table.approvalHeaderCell}>실행</th>
                  <th className={idcStyles.table.approvalHeaderCell}>판정</th>
                  <th className={idcStyles.table.approvalHeaderCell}>요청</th>
                  <th className={idcStyles.table.approvalHeaderCell}>완료</th>
                  <th className={idcStyles.table.approvalHeaderCell}>소요</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {state.data.content.map((row, index) => {
                  const tag = STATUS_TAG[row.status];
                  return (
                    <tr key={`${row.version ?? 'v'}-${index}`}>
                      <td className={cn(idcStyles.table.approvalCell, 'font-mono text-[14px]', textColors.primary)}>
                        {row.version !== null ? `#${row.version}` : '—'}
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <span className={cn(idcStyles.tag.base, tag.className)}>{tag.label}</span>
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, 'text-[14px]', textColors.secondary)}>
                        {fmtDateTime(row.requestedAt)}
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, 'text-[14px]', textColors.secondary)}>
                        {fmtDateTime(row.completedAt)}
                      </td>
                      <td className={cn(idcStyles.table.approvalCell, 'text-[14px]', textColors.secondary)}>
                        {tcElapsedLabel(row.requestedAt, row.completedAt) ?? '—'}
                      </td>
                    </tr>
                  );
                })}
                {state.data.content.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className={cn(idcStyles.table.approvalCell, 'py-8 text-center text-[14px]', textColors.tertiary)}
                    >
                      아직 실행한 연결 테스트가 없어요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 text-[14px]">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className={cn(idcStyles.triggerBtn.ghostSm, 'disabled:cursor-not-allowed disabled:opacity-40')}
                >
                  이전
                </button>
                <span className={textColors.tertiary}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={cn(idcStyles.triggerBtn.ghostSm, 'disabled:cursor-not-allowed disabled:opacity-40')}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
