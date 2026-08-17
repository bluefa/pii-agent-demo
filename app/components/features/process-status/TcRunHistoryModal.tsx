'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { borderColors, cn, idcStyles, textColors } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  getTestConnectionExecutionHistory,
  type TcExecutionPage,
  type TcExecutionStatus,
} from '@/app/lib/api/task-queue-tc';
import { tcElapsedLabel } from '@/lib/test-connection-summary';

// Same page numbers as ScanHistoryModal, the history-modal precedent this one
// follows: 5 per page pages a retention-scale trail, 10 is the dense option.
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10];

/**
 * The list frame holds one full page's height in every state — loading, error,
 * empty, and a short last page — so the modal never resizes with the row count.
 * Keyed by page size because the frame is (header 42.5px) + rows × 59.5px +
 * (pager 49px), measured off the rendered table — set a hair ABOVE that sum, so
 * the floor (not the row count) is always what decides the height.
 */
const FRAME_MIN_H: Record<number, string> = {
  5: 'min-h-[390px]',
  10: 'min-h-[688px]',
};

const STATUS_TAG: Record<TcExecutionStatus, { className: string; label: string }> = {
  SUCCESS: { className: idcStyles.tag.green, label: '성공' },
  FAIL: { className: idcStyles.tag.red, label: '실패' },
  RUNNING: { className: idcStyles.tag.orange, label: '진행 중' },
  PENDING: { className: idcStyles.tag.gray, label: '대기' },
  UNKNOWN: { className: idcStyles.tag.gray, label: '미확인' },
};

// Card-less list (ScanHistoryModal's table grammar): the modal body already
// insets the content, so only the outer columns drop their horizontal padding.
const HEAD_CELL = cn(
  idcStyles.table.approvalHeaderCell,
  'first:pl-0 last:pr-0 text-left text-[12px] font-semibold',
  textColors.secondary,
);
const BODY_CELL = cn(idcStyles.table.approvalCell, 'first:pl-0 last:pr-0');

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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Fetched pages are keyed by size:page; the current key missing from the
  // cache IS the loading state — no sync setState inside the effect.
  const [pages, setPages] = useState<Record<string, TcExecutionPage | 'error'>>({});
  const [retryNonce, setRetryNonce] = useState(0);

  const key = `${pageSize}:${page}`;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const k = `${pageSize}:${page}`;
    void getTestConnectionExecutionHistory(targetSourceId, page, pageSize)
      .then((data) => {
        if (active) setPages((prev) => ({ ...prev, [k]: data }));
      })
      .catch(() => {
        if (active) setPages((prev) => ({ ...prev, [k]: 'error' }));
      });
    return () => {
      active = false;
    };
  }, [open, targetSourceId, page, pageSize, retryNonce]);

  // Closing resets to the newest page and drops the cache so reopening re-reads —
  // a run may have finished since.
  const handleClose = () => {
    setPage(0);
    setPageSize(DEFAULT_PAGE_SIZE);
    setPages({});
    onClose();
  };

  // Dropping the key puts the frame back into loading; the nonce refires the fetch.
  const retry = () => {
    setPages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRetryNonce((n) => n + 1);
  };

  const current = pages[key];
  const state:
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; data: TcExecutionPage } =
    current === undefined
      ? { status: 'loading' }
      : current === 'error'
        ? { status: 'error' }
        : { status: 'ready', data: current };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      chrome="toss"
      size="2xl"
      title="연결 테스트 실행 이력"
      subtitle="최근 실행된 연결 테스트 기록이에요."
      footer={
        <Button variant="secondary" onClick={handleClose}>
          닫기
        </Button>
      }
    >
      <div className={cn('flex flex-col', FRAME_MIN_H[pageSize] ?? FRAME_MIN_H[DEFAULT_PAGE_SIZE])}>
        {state.status === 'loading' && (
          <div className="space-y-2.5" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn(idcStyles.skeletonBar, 'h-9 w-full rounded-lg')} />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className={cn('text-sm', textColors.tertiary)}>
              실행 이력을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
            <Button variant="secondary" onClick={retry} className="mt-4 text-sm">
              다시 시도
            </Button>
          </div>
        )}

        {/* Keyed on the rows, not on the total: a page past the end answers with a
            positive total and an empty list. */}
        {state.status === 'ready' && state.data.content.length === 0 && (
          <p className={cn('flex flex-1 items-center justify-center text-sm', textColors.tertiary)}>
            {state.data.totalElements === 0
              ? '아직 실행한 연결 테스트가 없어요.'
              : '이 페이지에는 기록이 없어요.'}
          </p>
        )}

        {/* No frame (border/shadow) around the list — a modal should not carry a
            card inside it; a header rule and the rows are the whole grammar. */}
        {state.status === 'ready' && state.data.content.length > 0 && (
          <div>
            {/* Bottom rule = the top edge the pager bar (border-t-0) needs to read as closed. */}
            <table className={cn('w-full border-b', borderColors.default)}>
              <thead>
                <tr className={cn('whitespace-nowrap border-b', borderColors.default)}>
                  <th className={HEAD_CELL}>실행</th>
                  <th className={HEAD_CELL}>판정</th>
                  <th className={HEAD_CELL}>요청</th>
                  <th className={HEAD_CELL}>완료</th>
                  <th className={HEAD_CELL}>소요</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {state.data.content.map((row, index) => {
                  const tag = STATUS_TAG[row.status];
                  return (
                    <tr key={`${row.version ?? 'v'}-${index}`}>
                      <td className={cn(BODY_CELL, 'font-mono text-[14px]', textColors.primary)}>
                        {row.version !== null ? `#${row.version}` : '—'}
                      </td>
                      <td className={BODY_CELL}>
                        <span className={cn(idcStyles.tag.base, tag.className)}>{tag.label}</span>
                      </td>
                      <td className={cn(BODY_CELL, 'whitespace-nowrap text-[14px]', textColors.secondary)}>
                        {fmtDateTime(row.requestedAt)}
                      </td>
                      <td className={cn(BODY_CELL, 'whitespace-nowrap text-[14px]', textColors.secondary)}>
                        {fmtDateTime(row.completedAt)}
                      </td>
                      <td className={cn(BODY_CELL, 'whitespace-nowrap font-mono text-[12px]', textColors.secondary)}>
                        {tcElapsedLabel(row.requestedAt, row.completedAt) ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={state.data.totalElements}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
