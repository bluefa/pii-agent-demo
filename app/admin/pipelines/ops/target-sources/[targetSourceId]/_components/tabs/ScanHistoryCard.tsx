'use client';

/**
 * Scan-history card — paged table; the whole row (click or Enter/Space) opens
 * the detail modal. Retention policy reads in the card description; error
 * cells stay empty when there is no error.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { formatDateTimeLocalDashed } from '@/lib/utils/date';
import { isScanSettled } from '@/app/components/features/scan/scan-labels';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  ScanStatusPill,
  errorLabel,
  fmtCount,
  fmtDuration,
  sortResourceCounts,
  totalOf,
  type ScanJob,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';

export const SCAN_HISTORY_PAGE_SIZE = 5;

export interface ScanHistoryCardProps {
  rows: ScanJob[];
  page: number;
  totalPages: number;
  loading: boolean;
  failed: boolean;
  /** Load a page — retry reuses it with the current page. */
  onPage: (page: number) => void;
  onRowOpen: (row: ScanJob) => void;
}

export function ScanHistoryCard({
  rows,
  page,
  totalPages,
  loading,
  failed,
  onPage,
  onRowOpen,
}: ScanHistoryCardProps): ReactElement {
  const { table } = opsStyles;

  // The settled table and its skeleton share ONE head (`ApprovalHistoryCard` 의 규칙):
  // 열 이름은 이 화면이 이미 아는 고정 문자열이라 기다리는 동안에도 실물로 서고, 두 번
  // 적으면 열이 바뀌는 날 한쪽만 따라가 스켈레톤이 표의 자국이기를 조용히 그만둔다.
  const head = (
    <thead>
      <tr>
        <th className={table.headCell}>실행 일시</th>
        <th className={table.headCell}>완료 일시</th>
        <th className={table.headCell}>상태</th>
        <th className={table.headCell}>버전</th>
        <th className={table.headCell}>발견 리소스</th>
        <th className={table.headCell}>소요 시간</th>
        <th className={table.headCell}>오류</th>
      </tr>
    </thead>
  );

  return (
    <section className={pipelineStyles.card.base} aria-label="스캔 이력">
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        <Icon name="clock" size={18} className="text-[var(--pl-primary)]" />
        스캔 이력
      </h2>
      {/* Retention policy in page vocabulary (scan results · versions). Only the
          limit clause steps up one tier via weight+color (not size). */}
      <p className={opsStyles.cardDesc}>
        내부 정책에 따라 스캔 결과는{' '}
        <b className="font-semibold text-[var(--pl-text-medium)]">최근 10개 버전까지만 보관합니다.</b>
      </p>

      {loading ? (
        /* 표의 자국 — 같은 감쌈(`tableWrap` + mt-3), 같은 머리, 페이지 크기만큼의 행.
           종전의 h-10 막대 다섯은 머리도 테두리도 없어서, 값이 도착하는 순간 표가
           머리 한 줄(37.3px)만큼 통째로 밀렸다 — 막으려던 그 리플로우를 스스로 냈다.

           높이는 실측이다(브라우저 `getBoundingClientRect`): 머리 37.3px, 본문 행
           45.4px = py-3(24) + 20.4 + 헤어라인 1. 그 20.4 는 14px 글줄 상자(19.6)가
           아니라 상태 칸의 알약이 세운다 — `pill.md` 는 inline-flex 라 제 20px 위로
           글줄의 스트럿이 0.8px 을 더 얹는다. 그래서 글자 칸의 막대는 19.6 이 아니라
           그 20.4 를 들고, 알약 자리의 막대만 알약의 실제 높이(h-5)로 남는다
           (`ApprovalHistoryCard` 가 21/h-5 로 같은 계산을 한 그 자리다).
           ⚠️ 알약 크기나 이 표의 글자 크기를 바꾸면 20.4 부터 다시 잰다. */
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')} aria-busy>
          <span className="sr-only">스캔 이력을 불러오는 중</span>
          <table className={table.base}>
            {head}
            <tbody aria-hidden>
              {Array.from({ length: SCAN_HISTORY_PAGE_SIZE }, (_, index) => (
                <tr key={index}>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[20.4px] w-[126px]')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[20.4px] w-[126px]')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-5 w-[62px] rounded-full')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[20.4px] w-[28px]')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[20.4px] w-[44px]')} />
                  </td>
                  <td className={table.cell}>
                    <span className={cn(opsStyles.skeletonBar, 'block h-[20.4px] w-[52px]')} />
                  </td>
                  {/* 오류 칸은 비운다 — 정착본에서도 오류가 없는 행은 빈 칸이다.
                      막대를 세우면 다섯 행 전부가 오류를 달고 올 것이라 예고하게 된다. */}
                  <td className={table.cell} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : failed ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>스캔 이력을 불러오지 못했습니다.</p>
          <PlButton variant="secondary" className="mt-3" onClick={() => onPage(page)}>
            다시 시도
          </PlButton>
        </div>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="search" message="스캔 이력이 없습니다." className="mt-2" />
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          <table className={table.base}>
            {head}
            <tbody>
              {rows.map((row, index) => {
                const rowCounts = sortResourceCounts(row.resource_count_by_resource_type);
                const settled = isScanSettled(row.scan_status);
                return (
                  // The whole row is the click target (Enter/Space too) — detail opens
                  // in a modal. Click is the only entry, so keyboard focus/activation
                  // attach to the row itself.
                  <tr
                    key={row.id ?? `${row.created_at ?? ''}-${index}`}
                    tabIndex={0}
                    aria-haspopup="dialog"
                    className={cn(
                      table.rowHover,
                      'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pl-primary)]',
                    )}
                    onClick={() => onRowOpen(row)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowOpen(row);
                      }
                    }}
                  >
                    <td className={cn(table.cell, 'whitespace-nowrap')}>{formatDateTimeLocalDashed(row.created_at)}</td>
                    {/* 완료 일시·소요 시간은 끝난 잡에만 — 저장 중인 행에 이 둘을 적으면
                        같은 행을 여는 상세가 둘을 감추므로 표와 모달이 서로 다른 말을 한다. */}
                    <td className={cn(table.cell, 'whitespace-nowrap')}>
                      {settled ? formatDateTimeLocalDashed(row.updated_at) : <span className="text-[var(--pl-text-faint)]">—</span>}
                    </td>
                    <td className={table.cell}>
                      <ScanStatusPill status={row.scan_status} />
                    </td>
                    <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                      #{row.scan_version ?? '-'}
                    </td>
                    <td className={cn(table.cell, 'tabular-nums')}>
                      {rowCounts.length > 0 ? (
                        `${fmtCount(totalOf(rowCounts))}개`
                      ) : (
                        <span className="text-[var(--pl-text-faint)]">—</span>
                      )}
                    </td>
                    <td className={cn(table.cell, 'whitespace-nowrap')}>
                      {settled ? fmtDuration(row.duration_seconds) : <span className="text-[var(--pl-text-faint)]">—</span>}
                    </td>
                    <td className={table.cell}>
                      {/* No error = empty cell — even '—' pulls the eye (ops feedback). */}
                      {row.scan_error && (
                        <span
                          className={cn(
                            opsStyles.statusTag,
                            'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
                          )}
                          title={errorLabel(row.scan_error)}
                        >
                          {row.scan_error}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OpsPagination page={page} totalPages={totalPages} onChange={onPage} />
    </section>
  );
}
