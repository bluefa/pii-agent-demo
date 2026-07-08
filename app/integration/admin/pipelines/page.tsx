'use client';

/**
 * Admin Pipeline dashboard (LIN-25 Phase C1-a) — /integration/admin/pipelines.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.1): period/status/
 * provider filter server-side; the substring search, "실패 → 진행 중 → 최신순"
 * priority sort and 5/page pagination run CLIENT-side over the fetched window
 * (size=200). Stats come from statistics/live (동작 중 · 현재) + statistics?period
 * (실패/성공 · 기간). Design fidelity: design/pipeline/admin-pipeline.html §Dashboard.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import {
  OrchestratorApiError,
  getLiveStatistics,
  getPipelineStatistics,
  listPipelines,
} from '@/app/lib/api/pipeline';
import type {
  CloudProvider,
  LivePipelineStatistics,
  PipelineStatistics,
  PipelineStatus,
  PipelineSummary,
  SpringPage,
  StatisticsPeriodToken,
} from '@/lib/pipeline/types';

import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { SegControl } from '@/app/integration/admin/pipelines/_components/SegControl';
import { SectionHeader } from '@/app/integration/admin/pipelines/_components/SectionHeader';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { FilterBar } from '@/app/integration/admin/pipelines/_components/FilterBar';
import { SearchBox } from '@/app/integration/admin/pipelines/_components/SearchBox';
import { PlSelect } from '@/app/integration/admin/pipelines/_components/PlSelect';
import {
  PlChevCell,
  PlRow,
  PlTable,
  PlTd,
  PlTh,
} from '@/app/integration/admin/pipelines/_components/PlTable';
import { ProvTag } from '@/app/integration/admin/pipelines/_components/ProvTag';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/integration/admin/pipelines/_components/PipelineProgressBar';
import { PlPagination } from '@/app/integration/admin/pipelines/_components/PlPagination';
import { PlEmptyState } from '@/app/integration/admin/pipelines/_components/PlEmptyState';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { PipelineTypeTag } from '@/app/integration/admin/pipelines/_components/PipelineTypeTag';

import {
  DASH_FETCH_SIZE,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  PROVIDER_OPTIONS,
  STATUS_OPTIONS,
  paginate,
  projectRows,
} from '@/app/integration/admin/pipelines/_dashboard/logic';
import { FilterChips } from '@/app/integration/admin/pipelines/_dashboard/FilterChips';

/** Grey read-only stat tile (design `.stat`) — Card can't carry the `title`
 *  tooltip the design puts on the tile, so it composes the `card.stat` token. */
function StatTile({
  labelMain,
  labelPeriod,
  value,
  title,
  error,
}: {
  /** Primary label — 14/600 medium (e.g. "실패"). */
  labelMain: string;
  /** Period addendum — 12/400 faint (e.g. "최근 24시간" / "현재"). */
  labelPeriod: string;
  value: ReactNode;
  title: string;
  error?: boolean;
}): ReactElement {
  const { card, text, filterChip } = pipelineStyles;
  return (
    <div className={card.stat} title={title}>
      <div className="flex items-center justify-between gap-2">
        <div className={text.statLabelMain}>{labelMain}</div>
        <span className={filterChip.scope}>{labelPeriod}</span>
      </div>
      <div className={cn(text.statValue, error ? text.statValueError : text.statValueDefault, 'mt-3')}>{value}</div>
    </div>
  );
}

const errorMessage = (err: unknown): string =>
  err instanceof OrchestratorApiError || err instanceof Error ? err.message : String(err);

export default function DashboardPage(): ReactElement {
  const router = useRouter();

  const [period, setPeriod] = useState<StatisticsPeriodToken>('1d');
  const [status, setStatus] = useState<'' | PipelineStatus>('');
  const [provider, setProvider] = useState<string>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [live, setLive] = useState<LivePipelineStatistics | null>(null);
  const [periodStats, setPeriodStats] = useState<PipelineStatistics | null>(null);

  const [pageData, setPageData] = useState<SpringPage<PipelineSummary> | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Stats effect — refetch live + period statistics whenever the period changes.
  // `signal.aborted` guards against out-of-order resolution on rapid toggles.
  useAbortableEffect(
    (signal) => {
      setLive(null);
      setPeriodStats(null);
      return Promise.all([getLiveStatistics(), getPipelineStatistics(period)])
        .then(([liveStats, stats]) => {
          if (signal.aborted) return;
          setLive(liveStats);
          setPeriodStats(stats);
        })
        .catch(() => {
          // Stats degrade to '—'; the list region owns the visible error surface.
        });
    },
    [period],
  );

  // List effect — server-side period/status/provider filtering only. `q`, page,
  // priority sort and slicing are pure client derivations (NOT in these deps, so
  // typing in the search box never refetches). retryNonce re-runs it on demand.
  useAbortableEffect(
    (signal) => {
      setListLoading(true);
      setListError(null);
      return listPipelines({
        period,
        status: (status || undefined) as PipelineStatus | undefined,
        provider: (provider || undefined) as CloudProvider | undefined,
        page: 0,
        size: DASH_FETCH_SIZE,
        sort: ['createdAt,desc', 'id,desc'],
      })
        .then((data) => {
          if (signal.aborted) return;
          setPageData(data);
          setListLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setListError(err);
          setListLoading(false);
        });
    },
    [period, status, provider, retryNonce],
  );

  const projected = useMemo(() => projectRows(pageData?.content ?? [], q), [pageData, q]);
  const { pages, current, slice } = useMemo(() => paginate(projected, page), [projected, page]);

  // Any filter change resets to page 1 (design: filter change → page 1).
  const resetPage = () => setPage(1);

  // Chip × handlers. status/provider are list-effect deps → the effect reruns
  // and clears listLoading, so setting it true here matches the seg/select
  // pattern. q is a pure client derivation (NOT a dep) → never touch listLoading
  // for it, or the loading state would stick with no refetch to clear it.
  const clearStatus = () => {
    setStatus('');
    resetPage();
    setListLoading(true);
  };
  const clearProvider = () => {
    setProvider('');
    resetPage();
    setListLoading(true);
  };
  const clearSearch = () => {
    setQ('');
    resetPage();
  };
  const resetFilters = () => {
    const serverFilterActive = Boolean(status) || Boolean(provider);
    setStatus('');
    setProvider('');
    setQ('');
    resetPage();
    if (serverFilterActive) setListLoading(true); // only refetch-triggering changes show loading
  };

  const runningValue = live ? live.running_pipeline_count : '—';
  const pendingValue = live ? live.pending_pipeline_count : '—';
  const failedCount = periodStats?.failed_count;
  const doneValue = periodStats ? periodStats.done_count : '—';
  const plabel = PERIOD_LABELS[period];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className={pipelineStyles.text.pageTitle}>대시보드</h1>
        <span className="inline-flex items-center gap-[10px]">
          <span
            className={cn(pipelineStyles.text.meta, 'inline-flex items-center gap-[5px]')}
            title="선택한 기간이 현황(실패·성공)과 파이프라인 목록에 함께 적용됩니다 — 생성시간 기준. 동작 중 카드만 현재 순간값"
          >
            <Icon name="clock" size="sm" /> 기간 · 대시보드 전체 적용
          </span>
          <SegControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(value) => {
              // Same-value guard: SegControl fires on every click. Without it,
              // listLoading would flip true while the fetch effect (keyed on
              // `period`) never reruns — a permanent loading state.
              if (value === period) return;
              setPeriod(value);
              resetPage();
              setListLoading(true); // period/status/provider refetch — show loading now
            }}
            ariaLabel="대시보드 기간"
          />
        </span>
      </div>

      <SectionHeader first title="현황" />
      <div className="grid grid-cols-[repeat(4,minmax(0,300px))] gap-3">
        <StatTile
          labelMain="동작 중 파이프라인"
          labelPeriod="현재"
          value={runningValue}
          title="현재 RUNNING 상태인 파이프라인 수 — 기간과 무관한 순간값"
        />
        <StatTile
          labelMain="대기 중 파이프라인"
          labelPeriod="현재"
          value={pendingValue}
          title="현재 PENDING 상태인 파이프라인 수 — 기간과 무관한 순간값"
        />
        <StatTile
          labelMain="실패"
          labelPeriod={plabel}
          value={failedCount ?? '—'}
          error={(failedCount ?? 0) > 0}
          title={`${plabel} 내 생성 기준`}
        />
        <StatTile
          labelMain="성공"
          labelPeriod={plabel}
          value={doneValue}
          title={`${plabel} 내 생성 기준`}
        />
      </div>

      <SectionHeader
        title={
          <span className="inline-flex items-center gap-2">
            파이프라인 목록
            <span className={pipelineStyles.filterChip.scope}>{plabel}</span>
          </span>
        }
      />
      <FilterBar className="mb-3">
        <SearchBox
          wrapClassName="w-[240px]"
          placeholder="TargetSourceId 검색"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            resetPage();
          }}
          aria-label="TargetSourceId 검색"
        />
        <PlSelect
          value={status}
          aria-label="상태 필터"
          onChange={(event) => {
            const next = event.target.value as '' | PipelineStatus;
            if (next === status) return; // same-value guard (see period seg)
            setStatus(next);
            resetPage();
            setListLoading(true);
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </PlSelect>
        <PlSelect
          value={provider}
          aria-label="CSP 필터"
          onChange={(event) => {
            const next = event.target.value;
            if (next === provider) return; // same-value guard (see period seg)
            setProvider(next);
            resetPage();
            setListLoading(true);
          }}
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </PlSelect>
      </FilterBar>

      <FilterChips
        status={status}
        provider={provider}
        q={q}
        onClearStatus={clearStatus}
        onClearProvider={clearProvider}
        onClearSearch={clearSearch}
        onResetFilters={resetFilters}
      />

      <Card>
        {listLoading ? (
          <div className="min-h-[240px]" aria-busy="true" />
        ) : listError != null ? (
          <PlEmptyState
            icon="inbox"
            message={errorMessage(listError)}
            meta={
              <PlButton variant="secondary" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
                재시도
              </PlButton>
            }
          />
        ) : slice.length === 0 ? (
          <PlEmptyState icon="inbox" message="선택한 기간·조건에 맞는 파이프라인이 없어요" />
        ) : (
          <>
            <PlTable
              head={
                <>
                  <PlTh>TargetSourceId</PlTh>
                  <PlTh>CSP</PlTh>
                  <PlTh>파이프라인 유형</PlTh>
                  <PlTh>상태</PlTh>
                  <PlTh>진행도</PlTh>
                  <PlTh>생성시간</PlTh>
                  <PlTh />
                </>
              }
            >
              {slice.map((row) => (
                <PlRow
                  key={row.pipeline_id}
                  onActivate={() => router.push(integrationRoutes.pipelines.pipeline(row.pipeline_id))}
                >
                  <PlTd mono>{row.target_source_id}</PlTd>
                  <PlTd>
                    <ProvTag provider={row.cloud_provider} />
                  </PlTd>
                  <PlTd>
                    <PipelineTypeTag type={row.type} />
                  </PlTd>
                  <PlTd>
                    <StatusPill status={row.status} />
                  </PlTd>
                  <PlTd>
                    <PipelineProgressBar
                      n={row.done_task_count}
                      m={row.total_task_count}
                      status={row.status}
                    />
                  </PlTd>
                  <PlTd muted>{fmtDateTime(row.created_at)}</PlTd>
                  <PlChevCell title="파이프라인 상세로 이동" />
                </PlRow>
              ))}
            </PlTable>
            {/* R20 grammar — always visible so the list reads as a paged list. */}
            <PlPagination
              page={current}
              pages={pages}
              onPrev={() => setPage(current - 1)}
              onNext={() => setPage(current + 1)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
