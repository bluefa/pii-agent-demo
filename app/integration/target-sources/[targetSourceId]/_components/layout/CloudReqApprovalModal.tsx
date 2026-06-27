'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, interactiveColors, modalStyles, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { useToast } from '@/app/components/ui/toast';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { getLatestTestConnectionResultSummaries, updateTestConnectionConfirmation } from '@/app/lib/api';
import { StatTile } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  buildLogicalDbCountMap,
  type LogicalDbCountMap,
} from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';

interface CloudReqApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: readonly ConfirmedResource[];
  providerLabel: string;
  targetSourceId: number;
  onSubmit: () => void;
}

/**
 * Cloud completion-approval modal — v16 `#reqApprovalModal` (760px). Logical-DB
 * summary stats + a read-only resource table. 요청하기 PUTs the completion
 * acknowledgment (confirmed:true) then advances the step via refetch (onSubmit),
 * matching v16 `submitReqApproval` → `setStep(6)`. The card gates which targets reach
 * this modal, so the request itself is only acknowledgment + refetch.
 */
export const CloudReqApprovalModal = ({
  isOpen,
  onClose,
  resources,
  providerLabel,
  targetSourceId,
  onSubmit,
}: CloudReqApprovalModalProps) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Real per-resource logical-DB counts (연동 / 제외) from the latest test-connection
  // run. A resource with no summary entry renders "—" rather than a fabricated value.
  const [logicalDbCounts, setLogicalDbCounts] = useState<LogicalDbCountMap>(new Map());
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void getLatestTestConnectionResultSummaries(targetSourceId, { signal: controller.signal })
      .then((summaries) => {
        if (controller.signal.aborted) return;
        setLogicalDbCounts(buildLogicalDbCountMap(summaries));
      })
      .catch(() => {
        // No summaries available → leave the map empty so cells render "—".
      });
    return () => controller.abort();
  }, [isOpen, targetSourceId]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateTestConnectionConfirmation(targetSourceId, true);
      onSubmit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '완료 승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(resources, {
    initialPageSize: 5,
  });

  if (!isOpen) return null;

  const totalRes = resources.length;
  const totals = resources.reduce(
    (acc, r) => {
      const counts = logicalDbCounts.get(r.resourceId);
      if (!counts) return acc;
      return { target: acc.target + counts.target, excluded: acc.excluded + counts.excluded };
    },
    { target: 0, excluded: 0 },
  );
  const totalTarget = totals.target;
  const totalExcl = totals.excluded;

  return (
    <div
      className={modalStyles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn('mx-4 w-full max-w-[760px] overflow-hidden bg-white', modalStyles.toss.container)}
        role="dialog"
        aria-modal="true"
        aria-label="완료 승인 요청"
      >
        <div className={cn(modalStyles.toss.header, 'flex items-start justify-between')}>
          <div>
            <span className={idcStyles.reqModal.eyebrow}>
              <span className={idcStyles.reqModal.eyebrowDot} />
              Step 5 · {providerLabel} 연결 테스트
            </span>
            <h2 className={idcStyles.reqModal.title}>완료 승인 요청</h2>
            <p className={idcStyles.reqModal.sub}>
              아래 리소스에 대해 연동 완료 승인을 요청합니다. 각 리소스의 논리 DB 구성을 확인한 뒤 요청해
              주세요. 요청 후 관리자 검토가 시작되며, 변경이 필요하면 요청을 취소하고 다시 제출해야 해요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className={cn('rounded-lg p-2 transition-colors', interactiveColors.closeButton)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={modalStyles.toss.body}>
          <div className="mb-[18px] grid grid-cols-3 gap-3">
            <StatTile label="전체 리소스" value={totalRes} unit="건" variant="modal" />
            <StatTile label="연동 논리 DB" value={totalTarget} unit="개" swatch="target" variant="modal" />
            <StatTile label="제외한 논리 DB" value={totalExcl} unit="개" swatch="exclude" variant="modal" />
          </div>
          <div className={idcStyles.table.frame}>
            <table className="w-full">
              <thead className={idcStyles.reqModal.thHeader}>
                <tr>
                  <th className={cn(idcStyles.table.headerCell, 'w-[120px]')}>Database Type</th>
                  <th className={idcStyles.table.headerCell}>Resource Name</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[140px]')}>Region</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[104px] text-right')}>논리 DB 개수</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[120px] text-right')}>제외한 논리 DB</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((r) => {
                  const counts = logicalDbCounts.get(r.resourceId);
                  return (
                    <tr key={r.resourceId} className={idcStyles.table.row}>
                      <td className={idcStyles.table.cell}>
                        {r.databaseType ? (
                          <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>
                            {getDatabaseShortLabel(r.databaseType)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className={cn(idcStyles.table.cell, 'font-medium', textColors.primary)}>
                        {r.resourceName ?? '-'}
                      </td>
                      <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                        {r.region ?? '-'}
                      </td>
                      <td className={cn(idcStyles.table.cell, 'text-right font-semibold', textColors.secondary)}>
                        {counts ? counts.target + counts.excluded : '—'}
                      </td>
                      <td className={cn(idcStyles.table.cell, 'text-right')}>
                        {!counts ? (
                          <span className={cn('font-medium', textColors.quaternary)}>—</span>
                        ) : counts.excluded > 0 ? (
                          <span className={idcStyles.reqModal.exclNum}>{counts.excluded}</span>
                        ) : (
                          <span className={cn('font-medium', textColors.quaternary)}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalRes > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalRes}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>

        <div className={modalStyles.toss.footer}>
          <button type="button" onClick={onClose} disabled={submitting} className={idcStyles.modalBtn.gray}>
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(idcStyles.modalBtn.primary, 'flex items-center gap-2')}
          >
            {submitting && <LoadingSpinner />}
            요청하기
          </button>
        </div>
      </div>
    </div>
  );
};
