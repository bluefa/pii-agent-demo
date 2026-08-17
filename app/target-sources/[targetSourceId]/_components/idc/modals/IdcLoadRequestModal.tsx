'use client';

import { Modal } from '@/app/components/ui/Modal';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useIdcPreviousRequest } from '@/app/hooks/useIdcPreviousRequest';
import { usePagination } from '@/app/hooks/usePagination';
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
  verdictRailClass,
} from '@/lib/theme';
import {
  IdcDbTypeCell,
  IdcEndpointWithKindCell,
  IdcTargetPill,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import {
  clampReason,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';

// Same column grammar as the step-1 list (IdcTargetListTable): 구분 → 접속 주소 → Port →
// Database Type → 판정 → 제외 사유, at the step-1 widths. 연동 여부 is the one column step 1
// does not have under that name — it carries the 대상/비대상 verdict the checkbox carries there,
// which a read-only preview cannot show as a checkbox.
const HEADERS: ReadonlyArray<{ label: string; className?: string }> = [
  // 구분은 열이 아니다 — Domain 행에만 붙는 태그가 주소 위에 얹힌다(IdcEndpointWithKindCell).
  { label: '접속 주소' },
  { label: 'Port', className: 'w-[80px]' },
  { label: 'Database Type', className: 'w-[140px]' },
  { label: '연동 여부', className: 'w-[96px]' },
  { label: '제외 사유', className: 'w-[190px]' },
];

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
  // Fixed page size (IDC_LOAD_PER) with the modal's own prev/next/numbered controls;
  // the hook supplies the clamped page + slice, the bespoke footer stays below.
  const { page: safePage, setPage, pageItems: pageRows } = usePagination(resources, {
    initialPageSize: IDC_LOAD_PER,
  });

  const hasRows = resources.length > 0;
  const totalPages = Math.max(1, Math.ceil(resources.length / IDC_LOAD_PER));
  const start = safePage * IDC_LOAD_PER;
  const excludedCount = resources.filter((r) => r.excluded).length;
  const liveCount = resources.length - excludedCount;

  const canConfirm = !loading && !error && hasRows;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="기존 연동 정보를 불러올까요?"
      // The warning belongs to the sentence that states what is lost, not to the question:
      // beside the title it decorated the modal, in front of the subtitle it marks the risk.
      subtitle={
        <span className="inline-flex items-start gap-1.5">
          <StatusWarningIcon className={cn('mt-0.5 h-4 w-4 shrink-0', statusColors.warning.text)} />
          현재 입력한 정보는 모두 사라지고 아래 기존 연동 정보를 불러옵니다.
        </span>
      }
      size="wide"
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
            'rounded-xl border border-dashed px-6 py-10 text-center text-[12px]',
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
          <div className={cn('text-[12px]', textColors.tertiary)}>
            불러올 연동 대상 <strong className={textColors.secondary}>{resources.length}건</strong> · 연동{' '}
            <strong className={textColors.secondary}>{liveCount}건</strong> · 제외{' '}
            <strong className={textColors.secondary}>{excludedCount}건</strong>
          </div>

          <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
            <table className="w-full">
              <thead className={idcStyles.table.approvalHeader}>
                <tr className="whitespace-nowrap">
                  {HEADERS.map((h, i) => (
                    <th key={i} className={cn(idcStyles.table.approvalHeaderCell, h.className)}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((r) => {
                  // 제외 행을 흐리게 하지 않는다 — 표시는 왼쪽 레일이 맡는다(verdictRail).
                  return (
                    <tr
                      key={r.resourceId}
                      className={cn(ROW_BASE, r.excluded ? ROW_EXCLUDED : ROW_TARGET)}
                    >
                      <td
                        className={cn(idcStyles.table.approvalCell, verdictRailClass(r.excluded))}
                      >
                        <IdcEndpointWithKindCell resource={r} />
                      </td>
                      <td
                        className={cn(
                          idcStyles.table.approvalCell,
                          'font-mono text-[12px]',
                          textColors.secondary,
                        )}
                      >
                        {r.port || <span className={textColors.tertiary}>—</span>}
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <IdcDbTypeCell resource={r} />
                      </td>
                      <td className={idcStyles.table.approvalCell}>
                        <IdcTargetPill excluded={r.excluded} />
                      </td>
                      {/* Blank, not an em-dash: a 대상 row can never carry a reason (step 1). */}
                      <td className={idcStyles.table.approvalCell}>
                        {r.excluded && r.exclusionReason ? (
                          <ReasonChipInline
                            reason={r.exclusionReason}
                            summary={clampReason(r.exclusionReason)}
                          />
                        ) : null}
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
    {/* Real table markup, not a stand-in stack of divs: the header band and the column widths
        are chrome the rows arrive into, so the frame must not shift when they do. */}
    <div className={cn('overflow-hidden rounded-xl border', borderColors.default)}>
      <table className="w-full">
        <thead className={idcStyles.table.approvalHeader}>
          <tr className="whitespace-nowrap">
            {HEADERS.map((h, i) => (
              <th key={i} className={cn(idcStyles.table.approvalHeaderCell, h.className)}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={idcStyles.table.body}>
          {Array.from({ length: IDC_LOAD_PER }).map((_, i) => (
            <tr key={i}>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-5 w-16 rounded-md')} />
              </td>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-4 w-full rounded')} />
              </td>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-4 w-10 rounded')} />
              </td>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-4 w-20 rounded')} />
              </td>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-4 w-10 rounded')} />
              </td>
              <td className={idcStyles.table.approvalCell}>
                <div className={cn(idcStyles.skeletonBar, 'h-6 w-24 rounded-full')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
