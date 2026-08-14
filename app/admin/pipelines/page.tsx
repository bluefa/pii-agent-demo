'use client';

/**
 * Admin Pipeline dashboard (LIN-25 Phase C1-a) — /pass/admin/pipelines.
 *
 * Data strategy (docs/api/pipeline-orchestrator-bff.md §2.1): period/status/
 * provider/type filter server-side; the search-box substring search and the
 * pagination run CLIENT-side over the fetched window (size=200). That window is
 * a real ceiling, so the pager says so — but only when rows were actually left
 * behind.
 * Row ORDER always follows the API response verbatim — no client re-sort. Every
 * count on the page reads the SAME period as the list, which is what lets a
 * summary tile double as its own filter.
 * Visual language: docs/ux/benchmark/pipelines-dashboard.md. The row wears the
 * section's shared parts (ProvTag / PipelineTypeTag / step strip); what is local
 * is what the owner asked to differ, and it is written down in that file.
 * The list wears NO card — docs/ux/benchmark/pipelines-dashboard-flat.md. The
 * screen is one white surface (`dashboard.bleed`) with the table standing on it,
 * because a #FFFFFF card on a #F9FAFB page measured 1.05:1 and the boundary was
 * doing the work of a boundary nowhere.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { providerLabel, statusKo, typeKo } from '@/lib/pipeline/format';
import { OrchestratorApiError, getPipelineStatistics, listPipelines } from '@/app/lib/api/pipeline';
import type {
  CloudProvider,
  PipelineStatistics,
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  SpringPage,
  StatisticsPeriodToken,
} from '@/lib/pipeline/types';

import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { SegControl } from '@/app/admin/pipelines/_components/SegControl';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
// The list's three conditions live behind one trigger, as in step 1's resource
// table. This is the section's own --pl-* copy of that menu (see its comment).
import { FilterMenu } from '@/app/admin/pipelines/queue/requests/_components/ResourceFilterBar';
import {
  DashRow,
  ElapsedTime,
  RowAction,
  StatusText,
  TargetCell,
  Timestamp,
} from '@/app/admin/pipelines/_dashboard/cells';
import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
import { PipelineStepStrip } from '@/app/admin/pipelines/_components/PipelineStepStrip';

import {
  DASH_FETCH_SIZE,
  PERIOD_OPTIONS,
  PROVIDER_FILTERS,
  STATUS_FILTERS,
  TYPE_FILTERS,
  bucketCounts,
  paginate,
  projectRows,
  type DashBucket,
} from '@/app/admin/pipelines/_dashboard/logic';
import { FilterChips } from '@/app/admin/pipelines/_dashboard/FilterChips';

/** One summary bucket. The whole tile is the hit area — it is a filter, not a
 *  read-out — which is why the mark inside carries no container of its own. */
function BucketTile({
  label,
  value,
  icon,
  tone,
  active,
  onSelect,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  /** `alert` = 확인 필요 (bad news), `running` / `done` = 진행 중 · 종료 (mark
   *  colour only), `muted` = 전체 (not a bucket, no filter). */
  tone?: 'alert' | 'running' | 'done' | 'muted';
  active: boolean;
  onSelect: () => void;
}): ReactElement {
  const d = pipelineStyles.dashboard;
  const textTone =
    tone === 'alert' ? d.bucketToneAlert : tone === 'muted' ? d.bucketToneMuted : d.bucketToneDefault;
  const valueTone =
    tone === 'alert' ? d.bucketToneAlert : tone === 'muted' ? d.bucketToneDefault : d.bucketValueDefault;
  // 진행 중 · 종료 colour the MARK only — a blue or green label and value would
  // make those buckets read as loud as 확인 필요, which is the one that is.
  const markTone =
    tone === 'alert'
      ? d.bucketToneAlert
      : tone === 'running'
        ? d.bucketMarkActive
        : tone === 'done'
          ? d.bucketMarkOk
          : tone === 'muted'
            ? d.bucketMarkMuted
            : d.bucketToneDefault;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        d.bucketTile,
        // Exclusive, never merged — see the token comment.
        active ? d.bucketTileActive : tone === 'muted' ? d.bucketTileAllIdle : d.bucketTileIdle,
      )}
    >
      <span>
        <span className={cn(d.bucketLabel, textTone)}>{label}</span>
        <b className={cn(d.bucketValue, valueTone)}>{value}</b>
      </span>
      <Icon name={icon} size={24} className={cn(d.bucketMark, markTone)} />
    </button>
  );
}

/**
 * The four tiles, in scan order: what needs you, what is moving, what is over,
 * and the way back out. Marks come from the section's own icon set in the role
 * each glyph already plays there — `loader` is the arc StatusPill spins on
 * RUNNING, so a tile and the rows under it say "진행 중" with the same shape.
 */
const BUCKETS: ReadonlyArray<{
  key: DashBucket;
  label: string;
  icon: IconName;
  tone?: 'alert' | 'running' | 'done' | 'muted';
}> = [
  { key: 'attention', label: '확인 필요', icon: 'warn-tri', tone: 'alert' },
  { key: 'active', label: '진행 중', icon: 'loader', tone: 'running' },
  { key: 'closed', label: '종료', icon: 'check-circle', tone: 'done' },
  { key: 'all', label: '전체', icon: 'table', tone: 'muted' },
];

const errorMessage = (err: unknown): string =>
  err instanceof OrchestratorApiError || err instanceof Error ? err.message : String(err);

/**
 * 상태 옵션의 한글 라벨. `FilterGroup.formatOption` 은 `(value: string)` 이고
 * `statusKo` 는 enum 만 받으므로, 캐스팅 대신 옵션 목록에서 되찾아 좁힌다 —
 * 목록에 없는 값이 들어오면 원문을 그대로 돌려주므로 라벨이 비지 않는다.
 */
const statusOptionLabel = (value: string): string => {
  const known = STATUS_FILTERS.find((option) => option === value);
  return known ? statusKo(known) : value;
};

/** 작업 유형 옵션의 한글 라벨 — `statusOptionLabel` 과 같은 좁히기. */
const typeOptionLabel = (value: string): string => {
  const known = TYPE_FILTERS.find((option) => option === value);
  return known ? typeKo(known) : value;
};

export default function DashboardPage(): ReactElement {
  const router = useRouter();
  const d = pipelineStyles.dashboard;

  // 7일 default: 24시간 answered "what happened today", but the page is opened to
  // find work that is still waiting, and a job stalled since yesterday fell out
  // of a 24-hour window while still being the thing worth looking at.
  const [period, setPeriod] = useState<StatisticsPeriodToken>('7d');
  const [bucket, setBucket] = useState<DashBucket>('all');
  const [status, setStatus] = useState<'' | PipelineStatus>('');
  const [provider, setProvider] = useState<string>('');
  const [type, setType] = useState<'' | PipelineType>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [periodStats, setPeriodStats] = useState<PipelineStatistics | null>(null);

  const [pageData, setPageData] = useState<SpringPage<PipelineSummary> | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Stats effect — the bucket counts, refetched whenever the period changes.
  // `signal.aborted` guards against out-of-order resolution on rapid toggles.
  // The live (현재 순간값) endpoint is gone: every tile now counts the SAME
  // period as the list under it, which is what lets a tile double as its filter.
  useAbortableEffect(
    (signal) => {
      setPeriodStats(null);
      return getPipelineStatistics(period)
        .then((stats) => {
          if (signal.aborted) return;
          setPeriodStats(stats);
        })
        .catch(() => {
          // Counts degrade to '—'; the list region owns the visible error surface.
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

  const projected = useMemo(
    () => projectRows(pageData?.content ?? [], q, bucket),
    [pageData, q, bucket],
  );
  const { pages, current, slice } = useMemo(() => paginate(projected, page), [projected, page]);

  // Any filter change resets to page 1 (design: filter change → page 1).
  const resetPage = () => setPage(1);

  // Chip × handlers. status/provider/type are list-effect deps → the effect
  // reruns and clears listLoading, so setting it true here matches the seg/
  // select pattern. q is a pure client derivation (NOT a dep) → never touch
  // listLoading for it, or the loading state would stick with no refetch.
  // Bucket and the 상태 select are the SAME axis, so only one may be on: picking
  // 확인 필요 while the select says DONE would ask for rows that cannot exist.
  // Whichever the operator touched last wins, and the other resets.
  const selectBucket = (next: DashBucket) => {
    setBucket((prev) => (prev === next ? 'all' : next));
    resetPage();
    if (status) {
      setStatus('');
      setListLoading(true); // status is a fetch dep — clearing it refetches
    }
  };

  // One setter per server-side filter, shared by the filter menu and the chip ×
  // ('' is just another value there). The same-value guard matters for the menu:
  // it fires on every option click, and re-picking the current one would flip
  // listLoading true while the effect (keyed on the value) never reruns.
  const applyStatus = (next: string) => {
    if (next === status) return;
    setStatus(next as '' | PipelineStatus);
    if (next) setBucket('all'); // same axis as the tiles — see selectBucket
    resetPage();
    setListLoading(true);
  };
  const applyProvider = (next: string) => {
    if (next === provider) return;
    setProvider(next);
    resetPage();
    setListLoading(true);
  };
  const applyType = (next: string) => {
    if (next === type) return;
    setType(next as '' | PipelineType);
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
    setBucket('all');
    resetPage();
    if (serverFilterActive) setListLoading(true); // only refetch-triggering changes show loading
  };

  const counts = useMemo(() => bucketCounts(periodStats), [periodStats]);

  // Three conditions behind one trigger — step 1's list grammar. Open, they are
  // the same three choices; closed, the bar is a search box, and what is actually
  // set is said once, by the chip row, instead of by three selects reading 전체.
  const filterGroups = [
    {
      key: 'status',
      label: '상태',
      value: status,
      onChange: applyStatus,
      options: STATUS_FILTERS,
      // 메뉴가 부르는 이름과 행이 쓰는 이름이 같아야 한다 — 행이 "실패"인데
      // 메뉴만 FAILED 면 같은 값을 두 이름으로 부르는 셈이다.
      formatOption: statusOptionLabel,
    },
    {
      key: 'provider',
      label: 'Cloud',
      value: provider,
      onChange: applyProvider,
      options: PROVIDER_FILTERS,
      formatOption: providerLabel,
    },
    {
      key: 'type',
      label: '작업 유형',
      value: type,
      onChange: applyType,
      options: TYPE_FILTERS,
      // 상태 필터와 같은 이유 — 행이 "설치"면 메뉴도 "설치"여야 한다.
      formatOption: typeOptionLabel,
    },
  ];
  const hasFilter = Boolean(status) || Boolean(provider) || Boolean(type) || Boolean(q.trim());

  // The list is ONE fetch of at most DASH_FETCH_SIZE rows, so search and paging
  // only ever see that window. Compare against what actually arrived rather than
  // against the constant: if the server ever returns fewer, nothing was cut.
  const fetchedTotal = pageData?.totalElements ?? 0;
  const truncated = pageData != null && pageData.content.length < fetchedTotal;

  return (
    <div className={d.bleed}>
      <div className={d.headerRow}>
        <h1 className={pipelineStyles.text.dashboardPageTitle}>인프라 작업 대시보드</h1>
        <SegControl
          className={d.periodSeg}
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

      <div className={d.bucketGrid}>
        {BUCKETS.map((b) => (
          <BucketTile
            key={b.key}
            label={b.label}
            value={counts[b.key] ?? '—'}
            icon={b.icon}
            tone={b.tone}
            active={bucket === b.key}
            onSelect={() => selectBucket(b.key)}
          />
        ))}
      </div>

      <div className={d.listBlock}>
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
          <span className={d.filterTrigger}>
            <FilterMenu groups={filterGroups} />
          </span>
        </div>

        {hasFilter && (
          <div className={d.chipsWrap}>
            <FilterChips
              status={status}
              provider={provider}
              type={type}
              q={q}
              onClearStatus={() => applyStatus('')}
              onClearProvider={() => applyProvider('')}
              onClearType={() => applyType('')}
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
          <div className={d.empty}>선택한 기간·조건에 맞는 작업이 없어요</div>
        ) : (
          <>
            <table className={d.table}>
              <thead>
                <tr>
                  <th className={cn(d.th, 'w-[38ch]')}>대상</th>
                  <th className={d.th}>작업 유형</th>
                  <th className={d.th}>상태</th>
                  <th className={d.th}>진행도</th>
                  <th className={d.th}>경과</th>
                  <th className={d.th}>생성시간</th>
                  <th className={d.th} />
                </tr>
              </thead>
              <tbody className={d.body}>
                {slice.map((row) => (
                  <DashRow
                    key={row.pipeline_id}
                    onActivate={() => router.push(passRoutes.pipelines.pipeline(row.pipeline_id))}
                  >
                    <td className={d.cell}>
                      <TargetCell
                        name={row.service_name}
                        code={row.service_code}
                        targetId={String(row.target_source_id)}
                        provider={row.cloud_provider}
                        isSdu={row.is_sdu_type}
                      />
                    </td>
                    <td className={d.cell}>
                      <PipelineTypeTag type={row.type} />
                    </td>
                    <td className={d.cell}>
                      <StatusText status={row.status} />
                    </td>
                    <td className={d.cell}>
                      <PipelineStepStrip
                        n={row.done_task_count}
                        m={row.total_task_count}
                        status={row.status}
                      />
                    </td>
                    <td className={d.cell}>
                      <ElapsedTime
                        status={row.status}
                        createdAt={row.created_at}
                        lastActivityAt={row.last_activity_at}
                      />
                    </td>
                    <td className={d.cell}>
                      <Timestamp iso={row.created_at} />
                    </td>
                    <td className={d.actionCell}>
                      <RowAction />
                    </td>
                  </DashRow>
                ))}
              </tbody>
            </table>

            <div className={d.pager}>
              {/* The row count is gone (오너), but the fetch window is not a
                  preference — without this the truncated list reads as the whole
                  one. It stays, and only when rows were actually left behind. */}
              {truncated && (
                <span className={d.pagerTruncated}>
                  최근 {DASH_FETCH_SIZE}건만 불러왔어요 (전체 {fetchedTotal}건)
                </span>
              )}
              <button
                type="button"
                className={d.pagerBtn}
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                aria-label="이전 페이지"
              >
                <Icon name="chev-l" size={18} />
              </button>
              <span className={d.pagerCount}>
                <b className={d.pagerCurrent}>{current}</b> / {pages}
              </span>
              <button
                type="button"
                className={d.pagerBtn}
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                aria-label="다음 페이지"
              >
                <Icon name="chev-r" size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
