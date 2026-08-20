'use client';

/**
 * Scan-history card — paged table; the whole row (click or Enter/Space) opens
 * the detail modal. Retention policy reads in the card description; error
 * cells stay empty when there is no error.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { formatDateTimeLocalDashed } from '@/lib/utils/date';
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
        // Row-height (≈40px) × page-size skeleton — draws the table's footprint instead of a blank gap.
        <div className="mt-3" aria-busy>
          {Array.from({ length: SCAN_HISTORY_PAGE_SIZE }, (_, index) => (
            <div key={index} className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')} aria-hidden="true" />
          ))}
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
            <tbody>
              {rows.map((row, index) => {
                const rowCounts = sortResourceCounts(row.resource_count_by_resource_type);
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
                    <td className={cn(table.cell, 'whitespace-nowrap')}>{formatDateTimeLocalDashed(row.updated_at)}</td>
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
                    <td className={cn(table.cell, 'whitespace-nowrap')}>{fmtDuration(row.duration_seconds)}</td>
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
