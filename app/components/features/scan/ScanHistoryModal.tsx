'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { ArrowUpRightIcon } from '@/app/components/ui/icons';
import { ScanDetail } from '@/app/components/features/scan/ScanDetail';
import {
  scanDurationText,
  scanResultText,
  scanStatusLabel,
  scanStatusTagClass,
  type ScanJob,
} from '@/app/components/features/scan/scan-job-format';
import { getScanHistory } from '@/app/lib/api/scan';
import { borderColors, cn, idcStyles, primaryColors, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import type { CloudProvider } from '@/lib/types';

/**
 * Server-side paging (PageScanJobResponse), not a fixed first page. Retention
 * keeps the latest 10 versions, so 5 per page is the size that actually pages —
 * the admin history table uses the same number.
 */
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10];

/**
 * One page of history: the rows and the total the pager needs, from one response,
 * plus the page/size those rows answer for — the pager repaints on click, so the
 * rows on screen have to say which request they belong to.
 */
interface HistoryPage {
  jobs: ScanJob[];
  total: number;
  page: number;
  size: number;
}

// Card-less list: the modal body already insets the content, so only the outer
// columns drop their horizontal padding; between columns keeps the approval
// table's 18px.
const HEAD_CELL = cn(
  idcStyles.table.approvalHeaderCell,
  'first:pl-0 last:pr-0 text-left text-[12px] font-semibold',
  textColors.secondary,
);
const BODY_CELL = cn(idcStyles.table.approvalCell, 'first:pl-0 last:pr-0');

interface ScanHistoryModalProps {
  targetSourceId: number;
  /** Only used to trim the provider prefix off resource-type keys in the detail. */
  provider: CloudProvider;
  onClose: () => void;
}

/**
 * Scan history — time · status · duration · outcome, and a row opens that scan's
 * detail in place of the list. Replacing the body instead of stacking a second
 * modal keeps one owner for ESC and backdrop clicks.
 */
export const ScanHistoryModal = ({ targetSourceId, provider, onClose }: ScanHistoryModalProps) => {
  const [state, setState] = useState<AsyncState<HistoryPage>>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [retryNonce, setRetryNonce] = useState(0);
  const [detail, setDetail] = useState<ScanJob | null>(null);
  // Returning from the detail rebuilds the list, so focus is restored by row key
  // rather than by holding on to the (now discarded) element.
  const pendingFocusKey = useRef<string | null>(null);

  // setState only inside the promise callbacks (WaitingApprovalCard's fetch
  // pattern) — the effect body itself stays setState-free.
  useEffect(() => {
    let cancelled = false;
    void getScanHistory(targetSourceId, page, pageSize)
      .then((result) => {
        const jobs = result.content ?? [];
        if (!cancelled) {
          setState({
            status: 'ready',
            data: { jobs, total: result.totalElements ?? jobs.length, page, size: pageSize },
          });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: '스캔 이력을 불러오지 못했어요.' });
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, pageSize, retryNonce]);

  // Derived, not synced: the rows on screen are stale while they answer for a
  // different page than the pager now shows. They dim instead of unmounting —
  // unmounting takes the pager with them and the modal jumps.
  const pending =
    state.status === 'ready' && (state.data.page !== page || state.data.size !== pageSize);

  const retry = () => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  };

  const backToList = () => {
    setDetail(null);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      chrome="toss"
      size="xl"
      title={detail ? `스캔 결과 #${detail.scan_version ?? '-'}` : '스캔 이력'}
      subtitle={detail ? undefined : '최근 실행된 인프라 스캔 기록이에요.'}
      footer={
        detail ? (
          <Button variant="secondary" onClick={backToList}>목록으로</Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>닫기</Button>
        )
      }
    >
      {detail ? (
        <ScanDetail job={detail} provider={provider} />
      ) : (
        <>
          {state.status === 'loading' && (
            <div className="space-y-2.5" aria-busy="true" aria-live="polite">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(idcStyles.skeletonBar, 'h-9 w-full rounded-lg')} />
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div className="py-6 text-center">
              <p className={cn('text-sm', textColors.tertiary)}>{state.message}</p>
              <Button variant="secondary" onClick={retry} className="mt-4 text-sm">
                다시 시도
              </Button>
            </div>
          )}

          {/* Keyed on the rows, not on the total: a page past the end answers with a
              positive total and an empty list, and a header-only table with a pager
              reading past the total is not a state to render. */}
          {state.status === 'ready' && state.data.jobs.length === 0 && (
            <p className={cn('py-8 text-center text-sm', textColors.tertiary)}>
              {state.data.total === 0 ? '아직 실행된 스캔이 없어요.' : '이 페이지에는 기록이 없어요.'}
            </p>
          )}

          {/* No frame (border/shadow) around the list — a modal should not carry a
              card inside it; a header rule and the rows are the whole grammar. */}
          {state.status === 'ready' && state.data.jobs.length > 0 && (
            <div className={cn(pending && 'opacity-50 transition-opacity')} aria-busy={pending}>
              {/* Bottom rule = the top edge the pager bar (border-t-0) needs to read as closed. */}
              <table className={cn('w-full border-b', borderColors.default)}>
                <thead>
                  <tr className={cn('whitespace-nowrap border-b', borderColors.default)}>
                    <th className={HEAD_CELL}>실행 시각</th>
                    <th className={HEAD_CELL}>상태</th>
                    <th className={HEAD_CELL}>소요</th>
                    <th className={HEAD_CELL}>결과</th>
                    {/* Arrow column: no header — the row itself is the control. */}
                    <th className={cn(HEAD_CELL, 'w-6')} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody className={idcStyles.table.body}>
                  {state.data.jobs.map((job, index) => {
                    const rowKey = String(job.id ?? index);
                    const scannedAt = job.created_at ? formatDate(job.created_at, 'datetime') : '';
                    return (
                      // Row-as-button (role + Enter/Space), the DashRow pattern the
                      // admin history table already uses.
                      <tr
                        key={rowKey}
                        ref={(el) => {
                          if (el && pendingFocusKey.current === rowKey) {
                            pendingFocusKey.current = null;
                            el.focus();
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={scannedAt ? `${scannedAt} 스캔 상세 보기` : '스캔 상세 보기'}
                        onClick={() => {
                          pendingFocusKey.current = rowKey;
                          setDetail(job);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            pendingFocusKey.current = rowKey;
                            setDetail(job);
                          }
                        }}
                        // One token drives both pointer hover and keyboard focus, so
                        // the state is not pointer-only.
                        // `group/row` as well as the bare `group`: chipEdge is scoped
                        // `group-hover/row:`, and without the name it never fires — the
                        // status chip's fill is byte-identical to this row's hover tint
                        // (#E8F1FF), so the chip would vanish under the cursor.
                        className={cn('group group/row cursor-pointer outline-none', primaryColors.bgLightActive)}
                      >
                        <td className={cn(BODY_CELL, 'whitespace-nowrap text-[13px]', textColors.secondary)}>
                          {scannedAt}
                        </td>
                        <td className={BODY_CELL}>
                          <span className={cn(idcStyles.tag.base, scanStatusTagClass(job.scan_status))}>
                            {scanStatusLabel(job)}
                          </span>
                        </td>
                        <td className={cn(BODY_CELL, 'whitespace-nowrap font-mono text-[12px]', textColors.secondary)}>
                          {scanDurationText(job)}
                        </td>
                        <td className={cn(BODY_CELL, 'text-[13px]', textColors.secondary)}>
                          {scanResultText(job)}
                        </td>
                        <td className={cn(BODY_CELL, 'w-6 text-right')}>
                          {/* Hover/focus affordance: this row leads somewhere. */}
                          <ArrowUpRightIcon
                            className={cn(
                              'h-[13px] w-[13px] opacity-0 transition-opacity',
                              'group-hover:opacity-100 group-focus-visible:opacity-100',
                              primaryColors.text,
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={state.data.total}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(0);
                }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
};
