'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, interactiveColors, modalStyles, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { StatTile } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats';
import type { ConfirmedResource } from '@/lib/types/resources';

interface CloudReqApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: readonly ConfirmedResource[];
  providerLabel: string;
  onSubmit: () => void;
}

// v16 raRender surfaces per-resource logical-DB counts (total / excluded). The BFF
// contract does not carry these yet, so mirror ConfirmedIntegrationTable's stable
// hash → [target, excluded] pair.
// ponytail: duplicated ~12 lines from ConfirmedIntegrationTable; fold into one shared
// util once the schema exposes real counts (kept local now to avoid touching that file).
const LOGICAL_DB_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [12, 3],
  [8, 1],
  [5, 2],
  [10, 2],
  [6, 1],
];

const stableHash = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const deriveLogicalDbCounts = (resourceId: string): readonly [number, number] =>
  LOGICAL_DB_PAIRS[stableHash(resourceId) % LOGICAL_DB_PAIRS.length];

/**
 * Cloud completion-approval modal — v16 `#reqApprovalModal` (760px). Logical-DB
 * summary stats + a read-only resource table. Submit is ungated (the card's
 * completion-approval button gates on connection state before this opens) and advances
 * the step via refetch, matching v16 `submitReqApproval` → `setStep(6)`.
 */
export const CloudReqApprovalModal = ({
  isOpen,
  onClose,
  resources,
  providerLabel,
  onSubmit,
}: CloudReqApprovalModalProps) => {
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

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  if (!isOpen) return null;

  const counts = resources.map((r) => deriveLogicalDbCounts(r.resourceId));
  const totalRes = resources.length;
  const totalTarget = counts.reduce((sum, [target]) => sum + target, 0);
  const totalExcl = counts.reduce((sum, [, excluded]) => sum + excluded, 0);

  const safePage = Math.min(page, Math.max(0, Math.ceil(totalRes / pageSize) - 1));
  const pageRows = resources.slice(safePage * pageSize, safePage * pageSize + pageSize);

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
                  const [target, excluded] = deriveLogicalDbCounts(r.resourceId);
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
                        {target + excluded}
                      </td>
                      <td className={cn(idcStyles.table.cell, 'text-right')}>
                        {excluded > 0 ? (
                          <span className={idcStyles.reqModal.exclNum}>{excluded}</span>
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
              page={safePage}
              pageSize={pageSize}
              totalCount={totalRes}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(0);
              }}
            />
          )}
        </div>

        <div className={modalStyles.toss.footer}>
          <button type="button" onClick={onClose} className={idcStyles.modalBtn.gray}>
            취소
          </button>
          <button type="button" onClick={onSubmit} className={idcStyles.modalBtn.primary}>
            요청하기
          </button>
        </div>
      </div>
    </div>
  );
};
