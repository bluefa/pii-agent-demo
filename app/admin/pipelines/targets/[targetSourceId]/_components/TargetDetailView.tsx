'use client';

/**
 * Target detail (C2-a) — R24 redesign (Figma SzifNRYweRXhiIDI0uyK3R node 9-2).
 * Layout: h1 + CSP front-matter strip (R21 §C1 kept) → NEW "현재 파이프라인"
 * section (run-card in the drawer kv grammar + current-task strip while a run
 * is live, dashed empty card with the start CTA otherwise; one run per target)
 * → "파이프라인 이력" as a real table (header row, fixed colgroup, type tile +
 * recipe name, 실행 시각 range, ↗ detail link; the live run's row tinted).
 * The header CTA disables while a run is live — 시작 유도 moves into the empty
 * card. A live run polls its PipelineDetail every 8s; on the terminal
 * transition the latest/history queries refetch. Raw target-source detail
 * (CSP metadata) comes from the reused BFF route via getRawTargetSourceDetail
 * (getProject drops those fields).
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { Card } from '@/app/admin/pipelines/_components/Card';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlBreadcrumb } from '@/app/admin/pipelines/_components/PlBreadcrumb';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { StatusPill } from '@/app/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/admin/pipelines/_components/PipelineProgressBar';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { wireProvider } from '@/app/admin/pipelines/_detail/customBuilder';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { targetCrumbs } from '@/app/admin/pipelines/_detail/pipelineBreadcrumb';
import { TypePill, TypeTile } from '@/app/admin/pipelines/_detail/r24Task';
import {
  CurrentPipelineCard,
  EmptyPipelineCard,
} from '@/app/admin/pipelines/targets/[targetSourceId]/_components/CurrentPipelineCard';
import { integrationRoutes } from '@/lib/routes';
import {
  fmtDateTime,
  isLivePipeline,
  providerAccentVar,
  providerKey,
  providerLabel,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  listPipelinesByTarget,
} from '@/app/lib/api/pipeline';
import {
  getRawTargetSourceDetail,
  type RawTargetSourceDetail,
} from '@/app/lib/api/pipeline-target';
import type {
  PipelineDetail,
  PipelineSummary,
  SpringPage,
  TaskCatalogEntry,
} from '@/lib/pipeline/types';

const HISTORY_SIZE = 5;
const LIVE_POLL_MS = 8_000;

interface MetaRow {
  k: string;
  v: string;
}

/** CSP metadata → flat front-matter rows (null values filtered; R21 §C1). */
function cspMetaRows(provider: string, raw: RawTargetSourceDetail | null): MetaRow[] {
  const m = raw?.metadata ?? {};
  const region = m.is_china_region != null ? (m.is_china_region ? 'China' : 'Global') : null;
  const byProvider: Record<string, Array<[string, string | null | undefined]>> = {
    aws: [
      ['Account', m.aws_account_id],
      ['Region', region],
    ],
    azure: [
      ['Tenant', m.tenant_id],
      ['Subscription', m.subscription_id],
    ],
    gcp: [['Project', m.gcp_project_id]],
  };
  return (byProvider[provider] ?? [])
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ({ k, v: String(v) }));
}

/** Install method → self-labelling chip text (수동/자동 설치), or null if unset. */
function installTagLabel(raw: RawTargetSourceDetail | null): string | null {
  const perm = raw?.metadata?.grant_service_terraform_execution_permission;
  return perm == null ? null : perm ? '자동 설치' : '수동 설치';
}

/** 실행 시각 cell — 'created → finished' (terminal) / 'created → 진행 중'. */
function runWindow(p: PipelineSummary): string {
  const start = fmtDateTime(p.created_at);
  if (isLivePipeline(p.status)) return `${start} → 진행 중`;
  const end = fmtDateTime(p.last_activity_at);
  // Drop the duplicated date when the run ends on the same day.
  const tail = end.slice(0, 10) === start.slice(0, 10) ? end.slice(11) : end;
  return `${start} → ${tail}`;
}

/** R24 section head — title 15/700 + caption 12.5 faint (Figma typo ramp). */
function R24Section({ title, desc }: { title: string; desc: string }): ReactElement {
  return (
    <div className="mt-11">
      <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--pl-text-strong)]">{title}</h2>
      <p className="mt-1 text-[14px] text-[var(--pl-text-faint)]">{desc}</p>
    </div>
  );
}

const HISTORY_TH =
  'bg-[var(--pl-gray-50)] border-b border-[var(--pl-border)] px-4 py-[9px] text-left text-[11px] font-medium text-[var(--pl-text-faint)] whitespace-nowrap';
const HISTORY_TD =
  'border-b border-[var(--pl-gray-100)] px-4 py-[13px] align-middle tabular-nums text-[13px] text-[var(--pl-text-strong)]';

export function TargetDetailView(): ReactElement {
  const router = useRouter();
  const params = useParams<{ targetSourceId: string }>();
  const targetSourceId = String(params.targetSourceId);
  const toast = usePlToast();
  const { text } = pipelineStyles;
  const fm = detailStyles.frontMeta;

  const [raw, setRaw] = useState<RawTargetSourceDetail | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // R24 — the current-run pair: the latest summary decides live/idle, the
  // polled detail feeds the run-card. `runsKey` refetches both + the history
  // (start / cancel / terminal transition).
  const [latest, setLatest] = useState<PipelineSummary | null>(null);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [liveDetail, setLiveDetail] = useState<PipelineDetail | null>(null);
  const [defs, setDefs] = useState<ReadonlyMap<string, TaskCatalogEntry>>(new Map());
  const [runsKey, setRunsKey] = useState(0);
  // Repo rule: modal open/close flows go through useModal. R21 §A1 — the type
  // choice happens INSIDE the modal, so there is no payload to ride.
  const previewModal = useModal();

  // Raw detail (identity strip + CSP metadata).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRaw(null);
      setRawError(null);
      try {
        const d = await getRawTargetSourceDetail(targetSourceId);
        if (!cancelled) setRaw(d);
      } catch (e: unknown) {
        if (!cancelled) setRawError(e instanceof Error ? e.message : '불러오기 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey]);

  // History page (server pagination; 5/page).
  useEffect(() => {
    let cancelled = false;
    listPipelinesByTarget(targetSourceId, { page: page - 1, size: HISTORY_SIZE })
      .then((p) => !cancelled && setHistory(p))
      .catch(() => !cancelled && setHistory(null));
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, reloadKey, runsKey]);

  // Latest run — live/idle switch for the 현재 파이프라인 section + CTA gating.
  useEffect(() => {
    let cancelled = false;
    getLatestPipelineByTarget(targetSourceId)
      .then((p) => {
        if (cancelled) return;
        setLatest(p);
        setLatestLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLatest(null);
        setLatestLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey, runsKey]);

  const liveId = latest && isLivePipeline(latest.status) ? latest.pipeline_id : null;

  // Live run — poll the detail; on the terminal transition refetch the pair.
  // A stale snapshot is never rendered: the render below matches
  // liveDetail.pipeline_id against liveId instead of resetting state here.
  useEffect(() => {
    if (liveId == null) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      try {
        const d = await getPipeline(liveId);
        if (cancelled) return;
        setLiveDetail(d);
        if (!isLivePipeline(d.status)) setRunsKey((k) => k + 1);
      } catch {
        /* transient poll failure — keep the last snapshot */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveId]);

  // Task-definition catalog — display names/descriptions for the task strip.
  // An SDU account is surfaced as SDU regardless of its underlying CSP
  // (metadata.is_sdu_type wins over cloud_provider — owner call): SDU has no
  // CSP metadata rows and no orchestrator wire provider (Custom stays disabled).
  const provider = raw?.metadata?.is_sdu_type ? 'sdu' : providerKey(raw?.cloud_provider ?? '');
  const orchProvider = raw ? wireProvider(provider) : null;
  useEffect(() => {
    if (!orchProvider || liveId == null) return;
    let cancelled = false;
    getTaskDefinitions(orchProvider)
      .then((res) => {
        if (!cancelled) setDefs(new Map(res.task_definitions.map((e) => [e.name, e])));
      })
      .catch(() => {
        /* strip falls back to wire names */
      });
    return () => {
      cancelled = true;
    };
  }, [orchProvider, liveId]);

  const goPipeline = useCallback(
    (id: number) => router.push(integrationRoutes.pipelines.pipeline(id)),
    [router],
  );

  if (rawError) {
    return (
      <Card>
        <PlEmptyState icon="inbox" message="대상 정보를 불러오지 못했습니다" center />
        <div className="flex justify-center">
          <PlButton variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            재시도
          </PlButton>
        </div>
      </Card>
    );
  }

  if (!raw) {
    return <div className={cn(detailStyles.skeleton, 'h-40')} aria-hidden="true" />;
  }

  const serviceCode = raw.service_code ?? '';
  const svcName = raw.service_name || serviceCode || targetSourceId;
  const metaRows = cspMetaRows(provider, raw);
  const installTag = installTagLabel(raw);

  const totalPages = history?.totalPages ?? 1;
  const rows = history?.content ?? [];
  const live = liveId != null;

  return (
    <div>
      <PlBreadcrumb crumbs={targetCrumbs(svcName, targetSourceId)} />

      {/* Page head — title only. R24: the start CTA lives in the 현재 파이프라인
          empty card (and its modal), not a top-right header button. */}
      <h1 className={text.pageTitle}>
        {svcName} <span className={cn(text.muted, 'font-normal')}>({serviceCode})</span>
      </h1>

      {/* R21 §C1 — metadata as a front-matter strip: reference info, not the hero.
          Stays on one line (flex-nowrap); scrolls horizontally when it can't fit. */}
      <div className={cn(fm.strip, 'overflow-x-auto')}>
        <span className={fm.item}>
          <span style={{ color: `var(${providerAccentVar(provider)})` }} className="inline-flex">
            <Icon name="cloud" size="sm" />
          </span>
          <span className={fm.strong}>{providerLabel(provider)}</span>
        </span>
        <span className={fm.sep} aria-hidden="true" />
        <span className={fm.item}>
          <span className={fm.k}>TargetSourceId</span>
          <span className={cn(fm.strong, 'tabular-nums')}>{targetSourceId}</span>
        </span>
        {installTag && (
          <>
            <span className={fm.sep} aria-hidden="true" />
            <span className={fm.tag}>{installTag}</span>
          </>
        )}
        {metaRows.map((r) => (
          <Fragment key={r.k}>
            <span className={fm.sep} aria-hidden="true" />
            <span className={fm.item}>
              <span className={fm.k}>{r.k}</span>
              {r.v}
            </span>
          </Fragment>
        ))}
      </div>

      {/* R24 — 현재 파이프라인: run-card while live, empty card otherwise. The
          section eyebrow lives inside the card itself (Figma 9:429). */}
      <div className="mt-11">
        {live && liveDetail && liveDetail.pipeline_id === liveId ? (
          <CurrentPipelineCard
            detail={liveDetail}
            defs={defs}
            onOpenPipeline={() => goPipeline(liveDetail.pipeline_id)}
          />
        ) : !latestLoaded || live ? (
          <div className={cn(detailStyles.skeleton, 'h-52')} aria-hidden="true" />
        ) : (
          <EmptyPipelineCard onStart={() => previewModal.open()} />
        )}
      </div>

      <R24Section title="파이프라인 이력" desc="이 대상에서 실행된 최신순으로 정렬된 파이프라인" />
      <div className="mt-3.5 overflow-hidden rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-xs)]">
        {rows.length ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <colgroup>
                <col className="w-[72px]" />
                <col />
                <col className="w-[112px]" />
                <col className="w-[132px]" />
                <col className="w-[190px]" />
                <col className="w-[230px]" />
                <col className="w-[64px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={HISTORY_TH}>#</th>
                  <th className={HISTORY_TH}>파이프라인</th>
                  <th className={HISTORY_TH}>유형</th>
                  <th className={HISTORY_TH}>상태</th>
                  <th className={HISTORY_TH}>진행도</th>
                  <th className={HISTORY_TH}>실행 시각</th>
                  <th className={cn(HISTORY_TH, 'text-center')}>상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.pipeline_id}
                    className={cn(
                      'cursor-pointer hover:bg-[var(--pl-gray-50)] [&:last-child>td]:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pl-primary)]',
                      p.pipeline_id === liveId &&
                        'bg-[color-mix(in_srgb,var(--pl-primary)_4%,transparent)]',
                    )}
                    role="button"
                    tabIndex={0}
                    aria-label={`파이프라인 #${p.pipeline_id} 상세 열기`}
                    onClick={() => goPipeline(p.pipeline_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        goPipeline(p.pipeline_id);
                      }
                    }}
                  >
                    <td className={cn(HISTORY_TD, 'font-semibold [font-family:var(--pl-font-mono)]')}>
                      #{p.pipeline_id}
                    </td>
                    <td className={HISTORY_TD}>
                      <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--pl-text-strong)]">
                        <TypeTile type={p.type} size="xs" />
                        {p.type === 'CUSTOM' ? 'Custom 파이프라인' : recipeDisplayName(p.recipe_definition)}
                      </span>
                    </td>
                    <td className={HISTORY_TD}>
                      <TypePill type={p.type} />
                    </td>
                    <td className={HISTORY_TD}>
                      <StatusPill status={p.status} />
                    </td>
                    <td className={HISTORY_TD}>
                      <PipelineProgressBar n={p.done_task_count} m={p.total_task_count} status={p.status} />
                    </td>
                    <td className={cn(HISTORY_TD, 'text-[12.5px] text-[var(--pl-text-weak)]')}>
                      {runWindow(p)}
                    </td>
                    <td className={cn(HISTORY_TD, 'text-center')}>
                      <span className="inline-flex text-[var(--pl-primary)]" title="파이프라인 상세로 이동">
                        <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {/* R20 — always visible so the history reads as a paged list. */}
            <div className="flex items-center justify-end border-t border-[var(--pl-gray-100)] bg-[var(--pl-gray-50)] px-4 py-1 text-[12px] text-[var(--pl-text-faint)]">
              <PlPagination
                page={page}
                pages={totalPages}
                onPrev={() => setPage((n) => Math.max(1, n - 1))}
                onNext={() => setPage((n) => Math.min(totalPages, n + 1))}
              />
            </div>
          </>
        ) : (
          <PlEmptyState icon="inbox" message="파이프라인 이력이 없어요" />
        )}
      </div>

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={targetSourceId}
        provider={orchProvider}
        showToast={toast.show}
      />
    </div>
  );
}
