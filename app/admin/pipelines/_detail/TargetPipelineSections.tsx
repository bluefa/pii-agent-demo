'use client';

/**
 * 현재 작업 + 작업 이력 sections for one target source (R24).
 *
 * The two sections sit side by side at 2:1. 현재 작업 is the tab's hero and keeps
 * its full run-card unchanged; 작업 이력 is an archive, so it is demoted by width
 * rather than deleted. Equal columns would have said the opposite — same width
 * reads as same weight.
 *
 * The history table was 8 columns wide (min-w-[920px], horizontally scrolling)
 * and two of them rendered the same field twice: 유형 was TypePill(p.type) one
 * column after TypeTile(p.type), and 상세 was a chevron on a row that is already
 * role="button". 진행도 is a full bar on every succeeded row — information only
 * on a failed one, where it now trails the status pill as `5/7`. What the narrow
 * column actually costs is 완료 시각, which moves to the run's own page.
 *
 * Section captions are gone: the tab states what it is once, in InfraStatusHead.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { useModal } from '@/app/hooks/useModal';
import { cn, pipelineStyles } from '@/lib/theme';
import { StatusPill } from '@/app/admin/pipelines/_components/StatusPill';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { CancelModal } from '@/app/admin/pipelines/_detail/CancelModal';
import { RestartModal } from '@/app/admin/pipelines/_detail/RestartModal';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { RestartBadge, TypeTile } from '@/app/admin/pipelines/_detail/r24Task';
import {
  CurrentPipelineCard,
  EmptyPipelineCard,
} from '@/app/admin/pipelines/_detail/CurrentPipelineCard';
import { TaskDetailModal } from '@/app/admin/pipelines/_detail/TaskDetailModal';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import type { GateStage } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import { passRoutes, type OpsTargetTabLabel } from '@/lib/routes';
import {
  fmtDateTime,
  isLivePipeline,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  listPipelinesByTarget,
} from '@/app/lib/api/pipeline';
import type {
  CloudProvider,
  PipelineDetail,
  PipelineSummary,
  SpringPage,
  TaskCatalogEntry,
  TaskSummary,
} from '@/lib/pipeline/types';

const HISTORY_SIZE = 5;
const LIVE_POLL_MS = 8_000;

/**
 * 최근 작업 keeps the short form of the gate: that card's CTAs stay disabled with
 * a reason line beside them (out of scope for the round that rewrote the empty
 * card), and a reason line has room for a clause, not for the two-sentence
 * hand-off the empty card now states.
 */
const RESTART_BLOCKED_REASON = '확정된 연동 정보가 없어 시작할 수 없습니다.';

export interface TargetPipelineSectionsProps {
  targetSourceId: string;
  /** Orchestrator wire provider; null = custom execution unsupported (e.g. SDU). */
  provider: CloudProvider | null;
  /** Opens the start-pipeline modal, which the tab owns (its head has the CTA). */
  onStart: () => void;
  /**
   * Set while 작업 시작 is closed: the sentence 현재 작업 states, and the one move
   * that opens it. Null (the default) allows starting.
   */
  startGate?: GateStage | null;
  /** Performs the gate's tab jump (the tab strip lives above this component). */
  onSelectTab: (tab: OpsTargetTabLabel) => void;
  /** Fired when a run reaches a terminal state, so the caller can refetch
   *  anything derived from it (the tab's Terraform status). */
  onRunsChanged?: () => void;
  /** Bump to refetch the run set — the caller started a run from a modal it owns. */
  refreshKey?: number;
}

export function TargetPipelineSections({
  targetSourceId,
  provider,
  onStart,
  startGate = null,
  onSelectTab,
  onRunsChanged,
  refreshKey = 0,
}: TargetPipelineSectionsProps): ReactElement {
  const router = useRouter();
  const toast = usePlToast();

  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  /** 0-based, as OpsPagination and the endpoint both count. */
  const [page, setPage] = useState(0);
  // R24 — the current-run pair: the latest summary decides live/idle, the
  // polled detail feeds the run-card. `runsKey` refetches both + the history
  // (start / cancel / terminal transition).
  const [latest, setLatest] = useState<PipelineSummary | null>(null);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [liveDetail, setLiveDetail] = useState<PipelineDetail | null>(null);
  const [defs, setDefs] = useState<ReadonlyMap<string, TaskCatalogEntry>>(new Map());
  const [runsKey, setRunsKey] = useState(0);
  // Repo rule: modal open/close flows go through useModal.
  const restartModal = useModal();
  const cancelModal = useModal();
  // The task the 상세·로그 modal is open for. A task, not an id: the modal needs
  // the definition name too, and the flow card already holds the row.
  const [openTask, setOpenTask] = useState<TaskSummary | null>(null);

  // History page (server pagination; 5/page).
  useEffect(() => {
    let cancelled = false;
    listPipelinesByTarget(targetSourceId, { page, size: HISTORY_SIZE })
      .then((p) => !cancelled && setHistory(p))
      .catch(() => !cancelled && setHistory(null));
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, runsKey, refreshKey]);

  // Latest run — live/idle switch for the 현재 작업 section.
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
  }, [targetSourceId, runsKey, refreshKey]);

  const live = latest != null && isLivePipeline(latest.status);
  const liveId = live ? latest.pipeline_id : null;
  // The section renders a detail for the latest run whenever there IS one: live
  // (polled) or terminal (fetched once). A finished run keeps its card so its
  // Task flow — and, on a stopped run, the CTA that answers it — stay on screen;
  // the empty card is for a target that has never run.
  const focusId = latest ? latest.pipeline_id : null;

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
        if (live && !isLivePipeline(d.status)) {
          setRunsKey((k) => k + 1);
          // The run just changed the infrastructure — whatever the caller
          // derived from it is now stale.
          onRunsChanged?.();
        }
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
  }, [focusId, live, onRunsChanged]);

  // Task-definition catalog — display names/descriptions for the task strip.
  useEffect(() => {
    if (!provider || focusId == null) return;
    let cancelled = false;
    getTaskDefinitions(provider)
      .then((res) => {
        if (!cancelled) setDefs(new Map(res.task_definitions.map((e) => [e.name, e])));
      })
      .catch(() => {
        /* strip falls back to wire names */
      });
    return () => {
      cancelled = true;
    };
  }, [provider, focusId]);

  const goPipeline = useCallback(
    (id: number) => router.push(passRoutes.pipelines.pipeline(id)),
    [router],
  );

  const totalPages = Math.max(1, history?.totalPages ?? 1);
  const rows = history?.content ?? [];
  const focusDetail = liveDetail && liveDetail.pipeline_id === focusId ? liveDetail : null;
  const { table } = opsStyles;

  return (
    <div>
      {/* The row stretches (grid default), and every card is `h-full flex-col`,
          so 현재 작업 and 작업 이력 always end on the same line whichever one is
          taller. min-w-0 on both tracks: an `fr` track floors at min-content, and
          the run card's Task 실행 흐름 strip is wider than that — without it the
          left column grows past 2fr and squeezes the archive off the row. */}
      <div className="mt-6 grid grid-cols-[2fr_1fr] gap-4">
        {/* R24 — the run card whenever a run exists (현재 작업 while live, 최근
            작업 once it has ended), the empty card only before the first one.
            They wrap rather than break at two thirds of the width. */}
        <div className="min-w-0">
          {focusDetail && live ? (
            <CurrentPipelineCard
              detail={focusDetail}
              sectionTitle="현재 작업"
              defs={defs}
              onOpenPipeline={() => goPipeline(focusDetail.pipeline_id)}
              onOpenOrigin={goPipeline}
              onCancel={() => cancelModal.open()}
              onRestart={() => restartModal.open()}
              onStartNew={onStart}
              onOpenTask={setOpenTask}
            />
          ) : focusDetail ? (
            /* The latest run has ended: the same card, so its Task flow stays on
               screen (owner), now carrying the actions that answer it — 재시작 on
               a stopped run, 새 작업 시작 on any of them. */
            <CurrentPipelineCard
              detail={focusDetail}
              sectionTitle="최근 작업"
              defs={defs}
              onOpenPipeline={() => goPipeline(focusDetail.pipeline_id)}
              onOpenOrigin={goPipeline}
              onCancel={() => cancelModal.open()}
              onRestart={() => restartModal.open()}
              onStartNew={onStart}
              blockedReason={startGate ? RESTART_BLOCKED_REASON : null}
              onOpenTask={setOpenTask}
            />
          ) : !latestLoaded || focusId != null ? (
            <div className={cn(detailStyles.skeleton, 'h-full min-h-[320px]')} aria-hidden="true" />
          ) : (
            <EmptyPipelineCard
              sectionTitle="현재 작업"
              onStart={onStart}
              gate={startGate}
              onSelectTab={onSelectTab}
            />
          )}
        </div>

        <div className="min-w-0">
          {/* pagedCard skeleton (ApprovalHistoryCard): a floor
              under the body so a card holding one run is not shorter than one
              holding five, `flex-1` to absorb whatever height the taller sibling
              sets, and the pager pinned to the bottom. */}
          <section
            aria-label="작업 이력"
            className={cn(pipelineStyles.card.flush, detailStyles.sectionCard.fill)}
          >
            <div className={detailStyles.sectionCard.head}>
              <div className={detailStyles.sectionCard.titleRow}>
                {/* The same blue tag its sibling wears — the pair share this head,
                    and one tag next to one heading would read as two ranks. */}
                <h3 className={detailStyles.sectionCard.title}>작업 이력</h3>
                {/* A count is only worth a line once there is something to count:
                    「총 0건」 next to an empty table says the same thing twice. */}
                {history != null && history.totalElements > 0 && (
                  <span className={detailStyles.sectionCard.meta}>
                    총 {history.totalElements}건
                  </span>
                )}
              </div>
            </div>
            <div className="min-h-[266px] flex-1 px-6 pt-4">
              {/* The head stays up even with nothing under it: 작업/상태 says what
                  this card WILL hold, where the centred icon-and-message empty
                  state put a second empty-looking panel inside an already empty
                  card.

                  table-fixed: auto layout resolves to min-content, and a long
                  recipe name plus a restart badge is wider than a third of the
                  row — the card's overflow-hidden would then clip the 상태
                  column away instead of letting the name ellipsis. */}
              <table className={cn(table.base, 'table-fixed')}>
                <colgroup>
                  <col />
                  <col className="w-[104px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={table.headCell}>작업</th>
                    <th className={cn(table.headCell, 'text-right')}>상태</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={2} className={cn(table.cell, 'text-[12px] text-[var(--pl-text-weak)]')}>
                        아직 실행한 작업이 없습니다.
                      </td>
                    </tr>
                  )}
                  {rows.map((p) => {
                    // 진행도 only where it carries information: a succeeded run
                    // is always n/n, a stopped one is where it stopped.
                    const stopped = p.status === 'FAILED' || p.status === 'CANCELLED';
                    return (
                      <tr
                        key={p.pipeline_id}
                        className={cn(
                          'cursor-pointer hover:bg-[var(--pl-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pl-primary)]',
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
                        <td className={cn(table.cell, 'min-w-0')}>
                          {/* min-w-0 twice: the flex container has to be able to
                              shrink inside the cell, and the name — a flex item
                              at min-width:auto — has to be allowed to go below
                              its min-content before `truncate` can ellipsis. */}
                          <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-[var(--pl-text-strong)]">
                            <TypeTile type={p.type} size="xs" />
                            <span className="min-w-0 truncate">
                              {p.type === 'CUSTOM'
                                ? '커스텀 작업'
                                : recipeDisplayName(p.recipe_definition)}
                            </span>
                          </span>
                          {/* The restart chip rides the metadata line, not the
                              name line: it is unshrinkable, so on the name line
                              it ate a 1/3-width column's whole title. */}
                          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
                            <span className="font-semibold tabular-nums [font-family:var(--pl-font-mono)]">
                              #{p.pipeline_id}
                            </span>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">{fmtDateTime(p.created_at)}</span>
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
                        <td className={cn(table.cell, 'text-right')}>
                          <StatusPill status={p.status} />
                          {stopped && p.total_task_count > 0 && (
                            <span className="mt-1 block text-[12px] tabular-nums text-[var(--pl-text-weak)]">
                              {p.done_task_count}/{p.total_task_count} 단계
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* The pager renders only when it has more than one page to offer.
                It used to be forced on (`always`) so the card kept one height
                whatever the data — that reason expired when the body got its own
                floor (min-h + flex-1), which holds the two cards level on its own. */}
            <div className="px-6 pb-5">
              <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </section>
        </div>
      </div>

      {/* Keyed per task so the fetch + attempt picker start clean on every open. */}
      {openTask && focusId != null && (
        <TaskDetailModal
          key={openTask.task_id}
          pipelineId={focusId}
          taskId={openTask.task_id}
          displayName={defs.get(openTask.task_definition)?.display_name ?? openTask.task_definition}
          onClose={() => setOpenTask(null)}
        />
      )}

      {/* Two-phase cancel (contract gap ⑤): the response may still be RUNNING
          with cancel_requested set, so the returned detail is rendered verbatim
          instead of assuming CANCELLED, and the run set is refetched either way. */}
      {liveId != null && cancelModal.isOpen && (
        <CancelModal
          open={cancelModal.isOpen}
          onClose={cancelModal.close}
          pipelineId={liveId}
          onCancelled={(detail) => {
            setLiveDetail(detail);
            setRunsKey((k) => k + 1);
            onRunsChanged?.();
          }}
          showToast={toast.show}
        />
      )}

      {/* Mounted only while open — see RestartModal (fresh state per open). */}
      {focusId != null && restartModal.isOpen && (
        <RestartModal
          open={restartModal.isOpen}
          onClose={restartModal.close}
          targetSourceId={targetSourceId}
          pipelineId={focusId}
          provider={provider}
          showToast={toast.show}
          onStale={() => setRunsKey((k) => k + 1)}
          onStarted={() => setRunsKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
