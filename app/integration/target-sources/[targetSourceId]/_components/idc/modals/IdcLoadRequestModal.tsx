'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useIdcPreviousRequest } from '@/app/hooks/useIdcPreviousRequest';
import { type IdcResourceView } from '@/app/lib/api/idc';
import { IDC_LOAD_PER } from '@/lib/constants/idc';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  numericFeatures,
  statusColors,
  textColors,
} from '@/lib/theme';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcKindBadge,
  IdcTargetPill,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';

interface IdcLoadRequestModalProps {
  isOpen: boolean;
  targetSourceId: number;
  /** Confirm → replace the working list entirely with the previous request. */
  onConfirm: (resources: IdcResourceView[]) => void;
  onClose: () => void;
}

/**
 * "기존 연동 요청 정보 불러오기" — warning header, paginated preview of the
 * previous request, skeleton while loading, empty state, confirm replaces the
 * working list (v15 idcLoadModal).
 *
 * The fetch runs through `useIdcPreviousRequest` (AbortController + stale-id
 * guard), so a slow/stray response from a previous open or a different target
 * source can never overwrite the rows shown here.
 */
export const IdcLoadRequestModal = ({
  isOpen,
  targetSourceId,
  onConfirm,
  onClose,
}: IdcLoadRequestModalProps) => {
  const { resources, loading, error } = useIdcPreviousRequest(targetSourceId);
  const [page, setPage] = useState(0);

  const hasRows = resources.length > 0;
  const totalPages = Math.max(1, Math.ceil(resources.length / IDC_LOAD_PER));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * IDC_LOAD_PER;
  const pageRows = resources.slice(start, start + IDC_LOAD_PER);
  const excludedCount = resources.filter((r) => r.excluded).length;
  const liveCount = resources.length - excludedCount;

  const canConfirm = !loading && !error && hasRows;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="기존 연동 정보를 불러올까요?"
      subtitle="현재 입력한 정보는 모두 사라지고 아래 기존 연동 정보를 불러옵니다."
      icon={<StatusWarningIcon className="h-5 w-5" />}
      size="2xl"
      chrome="toss"
      tone="warn"
      footer={
        <>
          <button type="button" className={idcStyles.modalBtn.outline} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={idcStyles.modalBtn.primary}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(resources)}
          >
            불러오기
          </button>
        </>
      }
    >
      {loading && <LoadPreviewSkeleton />}

      {!loading && error && (
        <div className={cn('px-6 py-12 text-center text-sm', statusColors.error.text)}>{error}</div>
      )}

      {!loading && !error && !hasRows && (
        <div
          className={cn(
            'rounded-xl border border-dashed px-6 py-10 text-center text-[13px]',
            borderColors.default,
            textColors.tertiary,
          )}
        >
          <strong className={cn('mb-1 block text-[14px]', textColors.secondary)}>
            불러올 기존 연동 정보가 없어요
          </strong>
          이전에 요청한 연동 정보가 있을 때만 불러올 수 있어요
        </div>
      )}

      {!loading && !error && hasRows && (
        <div className="space-y-3">
          <div className={cn('text-[12.5px]', textColors.tertiary)}>
            불러올 연동 대상 <strong className={textColors.secondary}>{resources.length}건</strong> · 연동{' '}
            <strong className={textColors.secondary}>{liveCount}건</strong> · 제외{' '}
            <strong className={textColors.secondary}>{excludedCount}건</strong>
          </div>

          <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
            <table className="w-full">
              <tbody className={idcStyles.table.body}>
                {pageRows.map((r) => {
                  const dim = r.excluded ? 'opacity-50' : '';
                  return (
                    <tr key={r.resourceId} className={cn(r.excluded && bgColors.muted)}>
                      <td className={cn('w-[104px] px-4 py-3', dim)}>
                        <IdcKindBadge kind={r.kind} />
                      </td>
                      <td className={cn('px-4 py-3', dim)}>
                        <IdcEndpointCell resource={r} />
                      </td>
                      <td className={cn('w-[64px] px-4 py-3 font-mono text-[12px]', textColors.secondary, dim)}>
                        {r.port}
                      </td>
                      <td className={cn('w-[140px] px-4 py-3', dim)}>
                        <IdcDbTypeCell resource={r} />
                      </td>
                      <td className="w-[180px] px-4 py-3">
                        {r.excluded ? (
                          <span className="inline-flex items-center gap-2">
                            <IdcTargetPill excluded />
                            {r.exclusionReason ? <ReasonChipInline reason={r.exclusionReason} /> : null}
                          </span>
                        ) : (
                          <IdcTargetPill excluded={false} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className={cn('text-[12px]', textColors.tertiary, numericFeatures.tabular)}>
                {start + 1}–{Math.min(start + IDC_LOAD_PER, resources.length)} / 전체 {resources.length}건
              </span>
              <div className="flex items-center gap-1">
                <PageBtn label="이전" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                  ‹
                </PageBtn>
                {Array.from({ length: totalPages }, (_, p) => (
                  <PageBtn key={p} label={`${p + 1} 페이지`} active={p === safePage} onClick={() => setPage(p)}>
                    {p + 1}
                  </PageBtn>
                ))}
                <PageBtn label="다음" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>
                  ›
                </PageBtn>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

/** Skeleton frame shown while the previous request loads — mirrors the preview table shape. */
const LoadPreviewSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    <div className={cn(idcStyles.skeletonBar, 'h-3.5 w-64 rounded')} />
    <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
      {Array.from({ length: IDC_LOAD_PER }).map((_, i) => (
        <div
          key={i}
          className={cn('flex items-center gap-3 px-4 py-3.5', i > 0 && cn('border-t', borderColors.light))}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-16 rounded-md')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 flex-1 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-4 w-12 rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-5 w-24 rounded-full')} />
        </div>
      ))}
    </div>
  </div>
);

interface PageBtnProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const PageBtn = ({ label, active = false, disabled = false, onClick, children }: PageBtnProps) => (
  <button
    type="button"
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
      numericFeatures.tabular,
      active
        ? cn(bgColors.primary, textColors.inverse, 'border-transparent')
        : cn(borderColors.default, textColors.secondary, bgColors.mutedHover),
    )}
  >
    {children}
  </button>
);
