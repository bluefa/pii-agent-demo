'use client';

/**
 * P1 운영 대시보드 (`/admin/pipelines/queue`) — the Task Queue operator landing.
 *
 * Two surfaces (design spec §1 / prototype `renderQueue`):
 *  1. 현황 — 4 read-only KPI stat tiles from GET dashboard-summary.
 *  2. Process Status 모니터 — a per-Target-Source table (current step + delay).
 *
 * Data model (api-spec §P1):
 *  - `processStatus` is a SERVER-side filter (refetch on change, page → 0).
 *  - The 지연 (delay) filter is CLIENT-side over the fetched page — contract gap
 *    G1 (no server query). Its tier counts + row filtering live in `_p1/logic`.
 *  - `delay_seconds` is server-computed; the client never recomputes elapsed time.
 *  - No background poll (it duplicated the shell's own summary fetch every
 *    tick). The monitor re-reads on filter/page change and on its 재시도; 현황
 *    rides the same `retryNonce` but has no control of its own. Otherwise the
 *    operator refreshes.
 *
 * Visual language: tqStyles (prototype pixel SSOT) + shared pipeline primitives.
 * The monitor table is composed from `pipelineStyles.table` tokens rather than
 * PlTable/PlTd: PlTd's fixed color roles can't express the 600-strong 서비스 이름
 * cell, and PlTable's tbody applies a zebra tint the flat prototype does not.
 */
import { useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';

import { SectionHeader } from '@/app/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';

import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { TqSegLg } from '@/app/admin/pipelines/queue/_components/TqSegLg';
import { TqSelectLg } from '@/app/admin/pipelines/queue/_components/TqSelectLg';
import { StepStack, STEP } from '@/app/admin/pipelines/queue/_components/StepStack';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { DelayText } from '@/app/admin/pipelines/queue/_components/DelayText';
import { TqEmptyState } from '@/app/admin/pipelines/queue/_components/bits';

import { getDashboardSummary, getProcessStatuses } from '@/app/lib/api/task-queue';
import type { DashboardSummary, Paged, ProcessStatusRow } from '@/lib/types/task-queue';
import { pageRange } from '@/app/admin/pipelines/queue/_p1/logic';
import type { DelayFilter } from '@/app/admin/pipelines/queue/_p1/logic';

const SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_SIZE = 20;


const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요';

/** Narrow the wire's `string | null` process_status to a known STEP key. */
function asProcessStatus(value: string | null): ProcessStatus | null {
  return value != null && value in STEP ? (value as ProcessStatus) : null;
}

type StatTone = 'strong' | 'warn' | 'err';

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: StatTone;
}): ReactElement {
  const { stat } = tqStyles;
  return (
    <div className={stat.tile}>
      <div className={stat.label}>{label}</div>
      <div className={cn(stat.value, stat.valueTone[tone])}>{value}</div>
    </div>
  );
}

export default function QueueDashboardPage(): ReactElement {
  const { text, table } = pipelineStyles;

  // 현황 — degrades to "—" on error (the monitor owns the visible error surface).
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  // 모니터 — every filter is server-side (delay via our route, api-spec G1).
  const [procStatus, setProcStatus] = useState('');
  const [delayFilter, setDelayFilter] = useState<DelayFilter>('all');
  const [page, setPage] = useState(0); // 0-indexed (contract)
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [procPage, setProcPage] = useState<Paged<ProcessStatusRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Summary fetch — degrades to "—" on error. It shares the monitor's
  // `retryNonce`, but that control only renders inside the monitor's own error
  // branch: when 현황 fails ALONE the tiles stay "—" until a browser refresh.
  // Acceptable because refresh is this console's stated refresh model; the tile
  // showing "—" is the visible signal.
  useAbortableEffect(
    (signal) =>
      getDashboardSummary({ signal })
        .then((data) => {
          if (!signal.aborted) setSummary(data);
        })
        .catch(() => {
          /* KPI tiles degrade to "—"; monitor surfaces the error. */
        }),
    [retryNonce],
  );

  // Monitor fetch — owns loading + error. Reruns on server-param change.
  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return getProcessStatuses(
        { processStatus: procStatus || undefined, delay: delayFilter, page, size },
        { signal },
      )
        .then((data) => {
          if (signal.aborted) return;
          setProcPage(data);
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [procStatus, delayFilter, page, size, retryNonce],
  );

  const visibleRows = useMemo(() => procPage?.content ?? [], [procPage]);

  const totalElements = procPage?.totalElements ?? 0;
  const totalPages = Math.max(1, procPage?.totalPages ?? 1);
  const pageIndex = procPage?.number ?? page; // 0-indexed (contract)
  const currentPage = pageIndex + 1; // 1-indexed for the pager
  const hasServerRows = totalElements > 0;
  const [firstOnPage, lastOnPage] = pageRange(pageIndex, size, totalElements);

  return (
    <div>
      <h1 className={cn(text.pageTitle, 'mb-6')}>운영 대시보드</h1>

      <SectionHeader first title="현황" />
      <div className={tqStyles.stat.grid}>
        <StatTile
          label="연동 요청 대기"
          value={summary ? summary.pendingApprovalCount : '—'}
          tone={summary ? 'warn' : 'strong'}
        />
        <StatTile
          label="연동 요청 반려"
          value={summary ? summary.rejectedApprovalCount : '—'}
          tone={summary && summary.rejectedApprovalCount > 0 ? 'err' : 'strong'}
        />
        <StatTile
          label="연결 테스트 완료"
          value={summary ? summary.testConnectionCompletedCount : '—'}
          tone="strong"
        />
        <StatTile
          label="연결 테스트 반려"
          value={summary ? summary.testConnectionRejectionCount : '—'}
          tone={summary && summary.testConnectionRejectionCount > 0 ? 'err' : 'strong'}
        />
      </div>

      <SectionHeader
        title="Process Status 모니터"
        desc="Target Source별 현재 단계와 지연(마지막 상태 변경 이후 경과)을 확인합니다. 최신 상태는 새로고침으로 다시 읽습니다."
      />
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <TqSelectLg
            aria-label="프로세스 상태 필터"
            value={procStatus}
            onChange={(event) => {
              const next = event.target.value;
              if (next === procStatus) return;
              setProcStatus(next);
              setPage(0);
            }}
          >
            <option value="">프로세스 상태 전체</option>
            {(Object.entries(STEP) as [ProcessStatus, (typeof STEP)[ProcessStatus]][]).map(
              ([key, step]) => (
                <option key={key} value={key}>
                  Step {step.n} · {step.label}
                </option>
              ),
            )}
          </TqSelectLg>
          {/* Delay filter drives the API call (our route applies it — gap G1). */}
          <TqSegLg<DelayFilter>
            ariaLabel="지연 필터"
            value={delayFilter}
            onChange={(next) => {
              if (next === delayFilter) return;
              setDelayFilter(next);
              setPage(0);
            }}
            options={[
              { label: '지연 전체', value: 'all' },
              { label: '1시간↑', value: 'd1', dot: 'd1' },
              { label: '1일↑', value: 'd2', dot: 'd2' },
              { label: '7일↑', value: 'd3', dot: 'd3' },
            ]}
          />
        </div>

        {loading ? (
          <div className="py-14 text-center text-[14px] text-[var(--pl-text-weak)]" aria-busy="true">
            불러오는 중이에요
          </div>
        ) : error != null ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-[14px] text-[var(--pl-text-weak)]">
            {errorMessage(error)}
            <PlButton variant="secondary" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
              재시도
            </PlButton>
          </div>
        ) : (
          <>
            <div className={tqStyles.appTable.wrap}>
              <table className={table.root}>
                <thead>
                  <tr>
                    <th className={tqStyles.listTable.th}>서비스 이름</th>
                    <th className={tqStyles.listTable.th}>서비스 코드</th>
                    <th className={tqStyles.listTable.th}>Target Source</th>
                    <th className={tqStyles.listTable.th}>Cloud</th>
                    <th className={tqStyles.listTable.th}>프로세스 상태</th>
                    <th className={tqStyles.listTable.th}>지연</th>
                    <th className={tqStyles.listTable.th}>상태 변경</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <TqEmptyState
                          title="조건에 맞는 Target Source가 없어요"
                          caption="필터를 바꾸면 다른 단계의 대상을 볼 수 있어요"
                        />
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const status = asProcessStatus(row.processStatus);
                      return (
                        <tr key={row.targetSourceId ?? `${row.serviceCode}-${row.statusChangedAt}`}>
                          <td className={cn(table.td, 'font-semibold text-[var(--pl-text-strong)]')}>
                            {row.serviceName ?? '—'}
                          </td>
                          <td className={cn(table.td, table.mono)}>{row.serviceCode ?? '—'}</td>
                          <td className={cn(table.td, table.mono)}>
                            {row.targetSourceId != null ? `#${row.targetSourceId}` : '—'}
                          </td>
                          <td className={cn(table.td, table.tdColor)}>
                            {row.cloudProvider ? <ProvTag provider={row.cloudProvider} /> : '—'}
                          </td>
                          <td className={cn(table.td, table.tdColor)}>
                            {status ? <StepStack status={status} /> : '—'}
                          </td>
                          <td className={cn(table.td, table.tdColor)}>
                            {row.delaySeconds != null ? (
                              <DelayText delaySeconds={row.delaySeconds} />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className={cn(
                              table.td,
                              'text-[12px] font-normal text-[var(--pl-text-weak)]',
                            )}
                          >
                            {fmtDateTime(row.statusChangedAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasServerRows && (
              <div className="flex items-center justify-between">
                <div className="mt-4 flex items-center gap-2">
                  <PlSelect
                    aria-label="페이지당 표시 건수"
                    value={size}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (next === size) return;
                      setSize(next);
                      setPage(0);
                    }}
                  >
                    {SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}건씩
                      </option>
                    ))}
                  </PlSelect>
                  <span className={pipelineStyles.pager.count}>
                    {firstOnPage}–{lastOnPage} / 전체 {totalElements}건
                  </span>
                </div>
                <PlPagination
                  page={currentPage}
                  pages={totalPages}
                  onPrev={() => setPage((p) => Math.max(0, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
