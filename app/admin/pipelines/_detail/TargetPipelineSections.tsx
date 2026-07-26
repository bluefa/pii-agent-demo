'use client';

/**
 * 현재 작업 + 작업 이력 sections for one target source (R24, extracted from
 * TargetDetailView so the targets page and the ops console 인프라 작업 tab render
 * the SAME experience: live run-card polled every 8s, start CTA in the empty
 * card, paged history table with the live row tinted).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { PlPagination } from '@/app/admin/pipelines/_components/PlPagination';
import { StatusPill } from '@/app/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/admin/pipelines/_components/PipelineProgressBar';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { RestartModal } from '@/app/admin/pipelines/_detail/RestartModal';
import { wireProvider } from '@/app/admin/pipelines/_detail/customBuilder';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { RestartBadge, TypePill, TypeTile } from '@/app/admin/pipelines/_detail/r24Task';
import {
  CurrentPipelineCard,
  EmptyPipelineCard,
  LastRunFailedCard,
} from '@/app/admin/pipelines/targets/[targetSourceId]/_components/CurrentPipelineCard';
import { passRoutes } from '@/lib/routes';
import {
  fmtDateTime,
  isLivePipeline,
  providerKey,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  listPipelinesByTarget,
} from '@/app/lib/api/pipeline';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type {
  PipelineDetail,
  PipelineSummary,
  SpringPage,
  TaskCatalogEntry,
} from '@/lib/pipeline/types';

const HISTORY_SIZE = 5;
const LIVE_POLL_MS = 8_000;

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

export interface TargetPipelineSectionsProps {
  targetSourceId: string;
  raw: RawTargetSourceDetail;
  /** First section's top margin — the standalone page uses the default mt-11. */
  firstSectionClassName?: string;
}

export function TargetPipelineSections({
  targetSourceId,
  raw,
  firstSectionClassName,
}: TargetPipelineSectionsProps): ReactElement {
  const router = useRouter();
  const toast = usePlToast();

  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  const [page, setPage] = useState(1);
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
  const restartModal = useModal();

  // History page (server pagination; 5/page).
  useEffect(() => {
    let cancelled = false;
    listPipelinesByTarget(targetSourceId, { page: page - 1, size: HISTORY_SIZE })
      .then((p) => !cancelled && setHistory(p))
      .catch(() => !cancelled && setHistory(null));
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, runsKey]);

  // Latest run — live/idle switch for the 현재 작업 section + CTA gating.
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
  }, [targetSourceId, runsKey]);

  const live = latest != null && isLivePipeline(latest.status);
  const liveId = live ? latest.pipeline_id : null;
  // The "현재 작업" section renders a detail for the latest run in TWO cases: it is
  // live (polled), or it ended FAILED/CANCELLED (§8.1 — fetched once, so the
  // failure context and the restart CTA share the screen).
  const focusId =
    latest && (live || latest.status === 'FAILED' || latest.status === 'CANCELLED')
      ? latest.pipeline_id
      : null;

  // Focused run — poll only while live; on the terminal transition refetch the
  // pair. A stale snapshot is never rendered: the render below matches
  // liveDetail.pipeline_id against focusId instead of resetting state here.
  useEffect(() => {
    if (focusId == null) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      try {
        const d = await getPipeline(focusId);
        if (cancelled) return;
        setLiveDetail(d);
        if (live && !isLivePipeline(d.status)) setRunsKey((k) => k + 1);
      } catch {
        /* transient poll failure — keep the last snapshot */
      }
    };
    void tick();
    if (!live) return () => {
      cancelled = true;
    };
    const timer = setInterval(() => void tick(), LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [focusId, live]);

  // Task-definition catalog — display names/descriptions for the task strip.
  // An SDU account is surfaced as SDU regardless of its underlying CSP
  // (metadata.is_sdu_type wins over cloud_provider — owner call).
  const provider = raw.metadata?.is_sdu_type ? 'sdu' : providerKey(raw.cloud_provider ?? '');
  const orchProvider = wireProvider(provider);
  useEffect(() => {
    if (!orchProvider || focusId == null) return;
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
  }, [orchProvider, focusId]);

  const goPipeline = useCallback(
    (id: number) => router.push(passRoutes.pipelines.pipeline(id)),
    [router],
  );

  const totalPages = history?.totalPages ?? 1;
  const rows = history?.content ?? [];
  const focusDetail = liveDetail && liveDetail.pipeline_id === focusId ? liveDetail : null;

  return (
    <div>
      {/* R24 — 현재 작업: run-card while live, empty card otherwise. The
          section eyebrow lives inside the card itself (Figma 9:429). */}
      <div className={firstSectionClassName ?? 'mt-11'}>
        {focusDetail && live ? (
          <CurrentPipelineCard
            detail={focusDetail}
            defs={defs}
            onOpenPipeline={() => goPipeline(focusDetail.pipeline_id)}
            onOpenOrigin={goPipeline}
          />
        ) : focusDetail ? (
          /* §8.1 — latest ended FAILED/CANCELLED: keep the failure on screen
             together with the action that answers it. */
          <LastRunFailedCard
            detail={focusDetail}
            defs={defs}
            onRestart={() => restartModal.open()}
            onStartNew={() => previewModal.open()}
            onOpenPipeline={() => goPipeline(focusDetail.pipeline_id)}
            onOpenOrigin={goPipeline}
          />
        ) : !latestLoaded || focusId != null ? (
          <div className={cn(detailStyles.skeleton, 'h-52')} aria-hidden="true" />
        ) : (
          <EmptyPipelineCard onStart={() => previewModal.open()} />
        )}
      </div>

      <R24Section title="작업 이력" desc="이 대상에서 실행된 최신순으로 정렬된 작업" />
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
                  <th className={HISTORY_TH}>작업</th>
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
                    aria-label={`작업 #${p.pipeline_id} 상세 열기`}
                    onClick={() => goPipeline(p.pipeline_id)}
                    onKeyDown={(e) => {
                      // Only the row itself activates: a keypress on the nested
                      // origin chip must reach its own button, not be swallowed
                      // here (preventDefault would suppress the chip's click and
                      // navigate to the WRONG pipeline).
                      if (e.target !== e.currentTarget) return;
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
                        {p.type === 'CUSTOM' ? 'Custom 작업' : recipeDisplayName(p.recipe_definition)}
                        {/* §8.3 — answers only "is this row a restart" (origin rows carry no chip). */}
                        {p.origin_pipeline_id != null && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <RestartBadge
                              originPipelineId={p.origin_pipeline_id}
                              onClick={() => goPipeline(p.origin_pipeline_id as number)}
                            />
                          </span>
                        )}
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
                      <span className="inline-flex text-[var(--pl-primary)]" title="작업 상세로 이동">
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
          <PlEmptyState icon="inbox" message="작업 이력이 없어요" />
        )}
      </div>

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={targetSourceId}
        provider={orchProvider}
        showToast={toast.show}
      />

      {/* Mounted only while open — see RestartModal (fresh state per open). */}
      {focusId != null && restartModal.isOpen && (
        <RestartModal
          open={restartModal.isOpen}
          onClose={restartModal.close}
          targetSourceId={targetSourceId}
          pipelineId={focusId}
          provider={orchProvider}
          showToast={toast.show}
          onStale={() => setRunsKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
