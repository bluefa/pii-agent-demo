'use client';

/**
 * Admin Pipeline dashboard (LIN-25 Phase C1-a) — /integration/admin/pipelines.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.1): period/status/
 * provider/type filter server-side; the search-box substring search and 5/page
 * pagination run CLIENT-side over the fetched window (size=200). Row ORDER
 * always follows the API response verbatim — no client re-sort. Stats come
 * from statistics/live (동작 중 · 현재) + statistics?period (실패/성공 · 기간).
 * Visual language: Figma Make redesign (dashboard-local `dashboard.*` tokens +
 * `_dashboard/cells`; the shared pill/table/progress components stay on the
 * detail pages untouched).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
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
  PipelineType,
  SpringPage,
  StatisticsPeriodToken,
} from '@/lib/pipeline/types';

import { Icon } from '@/app/integration/admin/pipelines/_components/icons';
import { SegControl } from '@/app/integration/admin/pipelines/_components/SegControl';
import { Card } from '@/app/integration/admin/pipelines/_components/Card';
import { SearchBox } from '@/app/integration/admin/pipelines/_components/SearchBox';
import { PlSelect } from '@/app/integration/admin/pipelines/_components/PlSelect';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import {
  CloudText,
  DashRow,
  GrayProgress,
  RelativeTime,
  RowAction,
  ServiceCell,
  StatusDot,
  TypeCell,
} from '@/app/integration/admin/pipelines/_dashboard/cells';

import {
  DASH_FETCH_SIZE,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  PROVIDER_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  paginate,
  projectRows,
} from '@/app/integration/admin/pipelines/_dashboard/logic';
import { FilterChips } from '@/app/integration/admin/pipelines/_dashboard/FilterChips';

/** KPI stat tile (Figma Make redesign) — centered badge → label → value.
 *  The badge is always neutral; its text ("현재" / "최근 24시간") carries the
 *  period meaning. */
function StatTile({
  labelMain,
  labelPeriod,
  value,
  error,
}: {
  labelMain: string;
  labelPeriod: string;
  value: ReactNode;
  error?: boolean;
}): ReactElement {
  const { card, dashboard, text, statBadge } = pipelineStyles;
  return (
    <div className={cn(card.stat, dashboard.kpiCard)}>
      <span className={statBadge.base}>{labelPeriod}</span>
      <div className={text.statLabelMain}>{labelMain}</div>
      <div className={cn(text.statValue, error ? text.statValueError : text.statValueDefault)}>
        {value}
      </div>
    </div>
  );
}

const errorMessage = (err: unknown): string =>
  err instanceof OrchestratorApiError || err instanceof Error ? err.message : String(err);

export default function DashboardPage(): ReactElement {
  const router = useRouter();
  const d = pipelineStyles.dashboard;

  const [period, setPeriod] = useState<StatisticsPeriodToken>('1d');
  const [status, setStatus] = useState<'' | PipelineStatus>('');
  const [provider, setProvider] = useState<string>('');
  const [type, setType] = useState<'' | PipelineType>('');
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

  // List effect — server-side period/status/provider/type filtering only. `q`,
  // page and slicing are pure client derivations (NOT in these deps, so typing
  // in the search box never refetches). retryNonce re-runs it on demand.
  useAbortableEffect(
    (signal) => {
      setListLoading(true);
      setListError(null);
      return listPipelines({
        period,
        status: (status || undefined) as PipelineStatus | undefined,
        provider: (provider || undefined) as CloudProvider | undefined,
        type: (type || undefined) as PipelineType | undefined,
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
    [period, status, provider, type, retryNonce],
  );

  const projected = useMemo(() => projectRows(pageData?.content ?? [], q), [pageData, q]);
  const { pages, current, slice } = useMemo(() => paginate(projected, page), [projected, page]);

  // Any filter change resets to page 1 (design: filter change → page 1).
  const resetPage = () => setPage(1);

  // Chip × handlers. status/provider/type are list-effect deps → the effect
  // reruns and clears listLoading, so setting it true here matches the seg/
  // select pattern. q is a pure client derivation (NOT a dep) → never touch
  // listLoading for it, or the loading state would stick with no refetch.
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
  const clearType = () => {
    setType('');
    resetPage();
    setListLoading(true);
  };
  const clearSearch = () => {
    setQ('');
    resetPage();
  };
  const resetFilters = () => {
    const serverFilterActive = Boolean(status) || Boolean(provider) || Boolean(type);
    setStatus('');
    setProvider('');
    setType('');
    setQ('');
    resetPage();
    if (serverFilterActive) setListLoading(true); // only refetch-triggering changes show loading
  };

  const runningValue = live ? live.running_pipeline_count : '—';
  const pendingValue = live ? live.pending_pipeline_count : '—';
  const failedCount = periodStats?.failed_count;
  const doneValue = periodStats ? periodStats.done_count : '—';
  const plabel = PERIOD_LABELS[period];
  const hasFilter = Boolean(status) || Boolean(provider) || Boolean(type) || Boolean(q.trim());

  return (
    <div>
      <div className={d.headerRow}>
        <h1 className={pipelineStyles.text.dashboardPageTitle}>Dashboard</h1>
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
      </div>

      <div className={d.kpiGrid}>
        <StatTile labelMain="동작 중 파이프라인" labelPeriod="현재" value={runningValue} />
        <StatTile labelMain="대기 중 파이프라인" labelPeriod="현재" value={pendingValue} />
        <StatTile
          labelMain="실패"
          labelPeriod={plabel}
          value={failedCount ?? '—'}
          error={(failedCount ?? 0) > 0}
        />
        <StatTile labelMain="성공" labelPeriod={plabel} value={doneValue} />
      </div>

      <Card variant="flush">
        <div className={d.listBar}>
          <h2 className={pipelineStyles.text.dashboardListTitle}>파이프라인 목록</h2>
          <span className={d.listStamp}>
            <Icon name="clock" size="sm" />
            {plabel}
          </span>
        </div>

        <div className={d.filterBar}>
          <SearchBox
            lg
            wrapClassName={d.searchWrap}
            placeholder="서비스 코드 / Target Source"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              resetPage();
            }}
            aria-label="서비스 코드 / Target Source / 서비스 이름 검색"
          />
          <PlSelect
            lg
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
            lg
            value={provider}
            aria-label="Cloud 필터"
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
          <PlSelect
            lg
            value={type}
            aria-label="파이프라인 유형 필터"
            onChange={(event) => {
              const next = event.target.value as '' | PipelineType;
              if (next === type) return; // same-value guard (see period seg)
              setType(next);
              resetPage();
              setListLoading(true);
            }}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </PlSelect>
        </div>

        {hasFilter && (
          <div className={d.chipsWrap}>
            <FilterChips
              status={status}
              provider={provider}
              type={type}
              q={q}
              onClearStatus={clearStatus}
              onClearProvider={clearProvider}
              onClearType={clearType}
              onClearSearch={clearSearch}
              onResetFilters={resetFilters}
            />
          </div>
        )}

        {listLoading ? (
          <div className={d.stateBox} aria-busy="true" />
        ) : listError != null ? (
          <div className={d.stateBox}>
            {errorMessage(listError)}
            <PlButton variant="secondary" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
              재시도
            </PlButton>
          </div>
        ) : slice.length === 0 ? (
          <div className={d.empty}>선택한 기간·조건에 맞는 파이프라인이 없어요</div>
        ) : (
          <>
            <table className={d.table}>
              <thead>
                <tr className={d.headRow}>
                  <th className={d.th}>서비스 / 대상</th>
                  <th className={d.th}>Cloud</th>
                  <th className={d.th}>파이프라인 유형</th>
                  <th className={d.th}>상태</th>
                  <th className={d.th}>진행도</th>
                  <th className={d.th}>생성시간</th>
                  <th className={d.th} />
                </tr>
              </thead>
              <tbody className={d.body}>
                {slice.map((row) => (
                  <DashRow
                    key={row.pipeline_id}
                    onActivate={() => router.push(integrationRoutes.pipelines.pipeline(row.pipeline_id))}
                  >
                    <td className={d.cell}>
                      <ServiceCell
                        code={row.service_code}
                        name={row.service_name}
                        targetId={String(row.target_source_id)}
                      />
                    </td>
                    <td className={d.cell}>
                      <CloudText provider={row.cloud_provider} />
                    </td>
                    <td className={d.cell}>
                      <TypeCell type={row.type} />
                    </td>
                    <td className={d.cell}>
                      <StatusDot status={row.status} />
                    </td>
                    <td className={d.cell}>
                      <GrayProgress n={row.done_task_count} m={row.total_task_count} />
                    </td>
                    <td className={d.cell}>
                      <RelativeTime iso={row.created_at} />
                    </td>
                    <td className={d.actionCell}>
                      <RowAction />
                    </td>
                  </DashRow>
                ))}
              </tbody>
            </table>

            <div className={d.pager}>
              <button
                type="button"
                className={d.pagerBtn}
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                aria-label="이전 페이지"
              >
                <Icon name="chev-l" size="sm" />
              </button>
              <span className={d.pagerCount}>
                {current} / {pages}
              </span>
              <button
                type="button"
                className={d.pagerBtn}
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                aria-label="다음 페이지"
              >
                <Icon name="chev-r" size="sm" />
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
