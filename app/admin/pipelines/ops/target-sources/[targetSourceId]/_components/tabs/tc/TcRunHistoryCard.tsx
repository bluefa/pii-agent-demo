'use client';

/**
 * 실행 기록 card — the RUNS (GET …/test-connection/execution-history), paged,
 * newest first. Sibling to the scan tab's 스캔 이력 card and built on the same
 * grammar.
 *
 * The 승인·반려 이력 CTA sits in this card's header, not the run card's: both are
 * history, and the operator looking for "누가 완료를 확인했나" is already reading
 * "언제 돌렸나". Naming is deliberate — 실행 기록 lists runs, 승인·반려 이력 lists
 * decisions; the old 수행/처리 pair were near-synonyms for two different tables.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { TcExecutionRow } from '@/app/lib/api/task-queue-tc';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { fmtDuration } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { Dash } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { TcRunPill } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/tcShared';
import { runDurationSeconds } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

export const TC_RUN_HISTORY_PAGE_SIZE = 5;

export interface TcRunHistoryCardProps {
  rows: readonly TcExecutionRow[];
  page: number;
  totalPages: number;
  loading: boolean;
  failed: boolean;
  onPage: (page: number) => void;
  onOpenDecisionHistory: () => void;
}

export function TcRunHistoryCard({
  rows,
  page,
  totalPages,
  loading,
  failed,
  onPage,
  onOpenDecisionHistory,
}: TcRunHistoryCardProps): ReactElement {
  const { table } = opsStyles;
  return (
    <section className={pipelineStyles.card.base} aria-label="실행 기록">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="clock" size={18} className="text-[var(--pl-primary)]" />
            실행 기록
          </h2>
          <p className={opsStyles.cardDesc}>
            연결 테스트를{' '}
            <b className="font-semibold text-[var(--pl-text-medium)]">언제 실행했고 결과가 무엇이었는지</b>
            의 회차별 기록입니다.
          </p>
        </div>
        <PlButton variant="secondary" className="flex-none" onClick={onOpenDecisionHistory}>
          승인·반려 이력
        </PlButton>
      </div>

      {loading ? (
        <div className="mt-3" aria-busy>
          {Array.from({ length: TC_RUN_HISTORY_PAGE_SIZE }, (_, index) => (
            <div
              key={index}
              className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : failed ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>실행 기록을 불러오지 못했습니다.</p>
          <PlButton variant="secondary" className="mt-3" onClick={() => onPage(page)}>
            다시 시도
          </PlButton>
        </div>
      ) : rows.length === 0 ? (
        <PlEmptyState icon="flow" message="연결 테스트 실행 기록이 없습니다." className="mt-2" />
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          <table className={table.base}>
            <thead>
              <tr>
                <th className={cn(table.headCell, 'w-[90px]')}>회차</th>
                <th className={cn(table.headCell, 'w-[180px]')}>요청 시각</th>
                <th className={cn(table.headCell, 'w-[180px]')}>완료 시각</th>
                <th className={cn(table.headCell, 'w-[120px]')}>소요 시간</th>
                <th className={table.headCell}>결과</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.version ?? 'run'}-${index}`} className={table.rowHover}>
                  <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                    {row.version == null ? <Dash /> : `#${row.version}`}
                  </td>
                  <td className={cn(table.cell, 'whitespace-nowrap')}>
                    {row.requestedAt ? fmtDateTime(row.requestedAt) : <Dash />}
                  </td>
                  <td className={cn(table.cell, 'whitespace-nowrap')}>
                    {row.completedAt ? fmtDateTime(row.completedAt) : <Dash />}
                  </td>
                  <td className={cn(table.cell, 'whitespace-nowrap tabular-nums')}>
                    {fmtDuration(runDurationSeconds(row.requestedAt, row.completedAt))}
                  </td>
                  <td className={table.cell}>
                    <TcRunPill status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsPagination page={page} totalPages={totalPages} onChange={onPage} />
    </section>
  );
}
