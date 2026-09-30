'use client';

/**
 * CurrentPipelineCard — R24 run-card body (Figma node 9-2, Header Section 17:3 +
 * Flow Track 9:506). ONE card for every run the section can focus on: recipe
 * title + #id + status pill (+ 중단 요청됨 once cancel is pending), recipe
 * description, a chrome meta line (시작 · 경과), and then a "Task 실행 흐름" line
 * — label left, the stage phrase as a neutral tag right — over the 16px grid
 * canvas that lays out EVERY task as a RunTaskCard (tile + status corner +
 * status pill) in one horizontally-scrolling row.
 *
 * The task flow is the card's CONTENT, not its footnote — it renders on a
 * finished or stopped run exactly as it does on a live one (owner: 작업이 완료돼도
 * Task를 잘 보여줘야 한다). One thing only branches on live/terminal: the action
 * group (중단 vs 재시작/새 작업 시작). Detailed progress lives on the 현황 page the
 * link points to.
 *
 * The derived Terraform impact note (이 작업은 실제 인프라를 변경합니다 + APPLY/PLAN/
 * DESTROY counts) is gone at the owner's word: every card in the flow right below
 * already wears its own JobKindTag, so the counts stated the same fact twice —
 * once as a total, once per task — and only the per-task form says WHICH task
 * does the destroying.
 *
 * EmptyPipelineCard is the same shell with a centered empty state and the start
 * CTA — that branch is only "no run has ever been created". There is no start
 * gate (owner 2026-09-11).
 *
 * The section NAME (현재 작업 / 최근 작업) is the card's own first line, and a blue
 * TAG rather than a heading — owner call, so the pair of cards in the 2:1 row
 * each carry their title inside instead of above, and neither competes with the
 * run name under it. `sectionCard.fill` keeps both columns one height.
 *
 * Data (detail polling, catalog map, cancel/restart flows) stays in the caller —
 * this file is presentation only.
 */
import { Fragment, useEffect, useRef, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { RequesterTag } from '@/app/admin/pipelines/_detail/RequesterTag';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  ServiceWorkNotice,
  type ServiceWorkNoticeData,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkNotice';
import {
  canCancel,
  elapsedMs,
  fmtDateTimeShortSec,
  fmtElapsedMs,
  isLivePipeline,
  progressPhrase,
  recipeDisplayName,
  recipeLabel,
  taskInfraSide,
} from '@/lib/pipeline/format';
import {
  FlowArrow,
  FlowStatusPill,
  R24_CSS,
  R24_RUN_CSS,
  RestartBadge,
  RunTaskCard,
} from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineDetail, TaskCatalogEntry, TaskSummary } from '@/lib/pipeline/types';

const CARD_SHELL =
  'overflow-hidden rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] shadow-[var(--pl-shadow-xs)]';

/** The card's own first line — a blue tag; see detailStyles.sectionCard. */
function SectionHead({ title }: { title: string }): ReactElement {
  const { sectionCard } = detailStyles;
  return (
    <div className={sectionCard.head}>
      <div className={sectionCard.titleRow}>
        {/* No glyph: a tag is a label, not a titled row. */}
        <h3 className={sectionCard.title}>{title}</h3>
      </div>
    </div>
  );
}

/** Value half of the meta line's label → value pairs (mirrors header `kvalue`). */
const metaValue = 'font-medium text-[var(--pl-text-medium)]';

export interface CurrentPipelineCardProps {
  detail: PipelineDetail;
  /** 현재 작업 (live) | 최근 작업 (terminal) — the section name, inside the card. */
  sectionTitle: string;
  /** task_definition name → catalog entry (display name + description). */
  defs: ReadonlyMap<string, TaskCatalogEntry>;
  onOpenPipeline: () => void;
  /** Opens the ORIGIN run when this one is a restart (restart badge). */
  onOpenOrigin?: (originPipelineId: number) => void;
  /** Opens the 작업 중단 confirmation (live). Never gated: stopping a run in
   *  flight is always allowed, whatever else on the page is blocked. */
  onCancel: () => void;
  /** Opens the 재시작 modal — offered on a FAILED/CANCELLED run only. */
  onRestart: () => void;
  /** Opens the start-pipeline modal (terminal). */
  onStartNew: () => void;
  /**
   * 서비스 측 작업 조회 결과. 설치 작업을 시작하기 전에 서비스가 끝내야 할 단계가 남았다면
   * 그 사실이 시작 동작 바로 위에 한 상자로 선다 — 잠그지는 않는다(주의이지 게이트가 아니다).
   * 실행 중인 카드는 받아도 그리지 않는다: 그 국면의 동작은 `작업 중단` 이지 시작이 아니다.
   */
  serviceWork?: ServiceWorkNoticeData | null;
  /** Opens one task's 상세·로그 modal. Omit to leave the flow non-interactive. */
  onOpenTask?: (task: TaskSummary) => void;
}

export function CurrentPipelineCard({
  detail,
  sectionTitle,
  defs,
  onOpenPipeline,
  onOpenOrigin,
  onCancel,
  onRestart,
  onStartNew,
  serviceWork = null,
  onOpenTask,
}: CurrentPipelineCardProps): ReactElement {
  const live = isLivePipeline(detail.status);
  // 재시작 resumes an interrupted run — a DONE one has nothing left to resume,
  // so that branch offers only 새 작업 시작 (restart-design §8.1, decision 5).
  const resumable = detail.status === 'FAILED' || detail.status === 'CANCELLED';
  const label = recipeLabel(detail.recipe_definition);
  const title =
    detail.type === 'CUSTOM' ? '커스텀 작업' : recipeDisplayName(detail.recipe_definition);
  const tasks = [...detail.tasks].sort((a, b) => a.sequence - b.sequence);
  const retry =
    detail.current_fail_count != null && detail.current_max_fail_count != null
      ? `시도 ${detail.current_fail_count + 1} / ${detail.current_max_fail_count}`
      : null;
  // The retry counter belongs to the CURRENT task (ADR-016: lowest READY /
  // IN_PROGRESS) — including a READY task waiting out its retry interval, so
  // a retrying task never reads as an untouched queued one (operator feedback).
  const retrySeq = detail.current_task_sequence;

  // Bring the in-progress (current) task into view in the horizontal flow so
  // attention lands on where the pipeline actually is (owner ask). Scrolls only
  // the track — computed from client rects so it never nudges the page.
  const flowRef = useRef<HTMLDivElement>(null);
  const focusSeq =
    tasks.find((t) => t.status === 'IN_PROGRESS')?.sequence ??
    tasks.find((t) => t.status === 'FAILED')?.sequence ??
    null;
  useEffect(() => {
    const track = flowRef.current;
    // `.rtc.cur` is the IN_PROGRESS card; a terminal run has none, so fall back
    // to the failed one and a stopped run opens on the task that broke.
    const el = track?.querySelector<HTMLElement>('.rtc.cur, .rtc.failed');
    if (!track || !el) return;
    const c = track.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const delta = e.left - c.left - (track.clientWidth - el.clientWidth) / 2;
    track.scrollBy({
      left: delta,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [focusSeq, detail.pipeline_id]);

  return (
    <div className={cn(CARD_SHELL, detailStyles.sectionCard.fill)}>
      <style>{R24_CSS + R24_RUN_CSS}</style>
      <SectionHead title={sectionTitle} />

      {/* header — title row + status, description, meta, actions, flow label.
          pt-4, not pt-5: the head above lost its caption line, and the tag wants
          the run name closer to it than a section heading did. */}
      <div className="px-6 pt-4 pb-1">
        {/* 시작 동작을 가진 국면에서만, 그 동작을 가진 행 바로 위에. 실행 중인 카드의 CTA 는
            `작업 중단` 이라 이 문장이 말을 걸 상대가 없다. */}
        {!live && <ServiceWorkNotice data={serviceWork} className="mb-4" />}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* 16px (owner 2026-08-30, down from 18px). The 18px was set when
                  the run had to out-rank a 16px section title two rows above it;
                  that title is a 12px tag now, so the run no longer needs the
                  extra step to win — and 16px puts it level with the neighbouring
                  설치 상태 card's title, which is the same rank of fact. */}
              <b className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--pl-text-strong)]">
                {title}
              </b>
              {/* --pl-text-weak, not faint: at 12px the faint grey reads 2.58:1
                  on the card. Same value the 작업 이력 row prints for this run. */}
              <span className="text-[12px] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]">
                #{detail.pipeline_id}
              </span>
              <FlowStatusPill status={detail.status} className="!px-2.5 !py-1 !text-[12px]" />
              {detail.origin_pipeline_id != null && (
                <RestartBadge
                  originPipelineId={detail.origin_pipeline_id}
                  onClick={onOpenOrigin ? () => onOpenOrigin(detail.origin_pipeline_id as number) : undefined}
                />
              )}
              {/* Cancel is two-phase (contract gap ⑤): a leased run keeps
                  RUNNING and only records the request, so without this the stop
                  button looked like it had done nothing. */}
              {live && detail.cancel_requested && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--pl-err-border)] bg-[var(--pl-err-bg)] px-2.5 py-[3px] text-[12px] font-semibold text-[var(--pl-err-text)]">
                  중단 요청됨
                </span>
              )}
            </div>
            {label?.desc ? (
              <p className="mt-1.5 max-w-[760px] text-[14px] leading-[1.55] text-[var(--pl-text-weak)]">
                {label.desc}
              </p>
            ) : null}
            {/* 경과, not 소요: `elapsedMs` measures from created_at, so it counts
                the wait before the first dispatch too. 시작 is the same instant,
                so both numbers share one origin — and it is the timestamp the
                작업 이력 row already shows for this run. The clock marks 시작 only:
                경과 is read off the same glyph, and a second one would make two
                clocks out of one line. */}
            {/* 수행 담당자는 시각 옆 불릿에서 빠져나와 자기 줄에 선다 — 작업 상세
                헤더와 같은 문법(라벨 + 태그)이라 두 화면이 같은 값을 같은 모양으로
                말한다(오너 2026-09-03). */}
            {detail.requested_by && (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-[12px] text-[var(--pl-text-weak)]">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  수행 담당자
                  <RequesterTag requestedBy={detail.requested_by} />
                </span>
                {/* 사유도 라벨을 달아 옆 칸과 같은 라벨→값으로 읽히게 한다. 카드는
                    헤더보다 폭이 넉넉해 줄바꿈으로 받고(자르지 않고), 전문은
                    title 로도 남긴다. */}
                {detail.request_note && (
                  <span className="flex items-center gap-1.5">
                    요청 사유
                    <span className={cn(metaValue, 'max-w-[520px]')} title={detail.request_note}>
                      {detail.request_note}
                    </span>
                  </span>
                )}
              </p>
            )}
            {/* break-keep: Hangul breaks between syllables by default, so on a
                narrow card the time line could split mid-word or strand its ·. */}
            {/* Each item is label → value: the value one step darker and heavier so
                시작 26.09.03 11:33 reads as a key and its value, not one phrase. */}
            <p className="mt-2 flex flex-wrap items-center gap-1 break-keep text-[12px] tabular-nums text-[var(--pl-text-weak)]">
              <Icon name="clock" size="sm" className="flex-none" />
              시작 <span className={metaValue}>{fmtDateTimeShortSec(detail.created_at)}</span> · 경과{' '}
              <span className={metaValue}>
                {fmtElapsedMs(elapsedMs(detail.status, detail.created_at, detail.last_activity_at))}
              </span>
            </p>
          </div>
          <div className="flex flex-none flex-col items-end gap-2 pt-0.5">
            <div className="flex items-center gap-3">
              <button type="button" className={opsStyles.detailLink} onClick={onOpenPipeline}>
                작업 현황 보기
                <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
              </button>
              {live ? (
                <PlButton
                  variant="danger"
                  size="sm"
                  onClick={onCancel}
                  disabled={!canCancel(detail.status, detail.cancel_requested)}
                >
                  <Icon name="stop" size="sm" />
                  작업 중단
                </PlButton>
              ) : (
                <>
                  {resumable && (
                    <PlButton
                      variant="primary"
                      size="sm"
                      onClick={onRestart}
                    >
                      <Icon name="play" size="sm" />
                      {/* Just the verb: the flow below names the task it resumes
                          from, and so does the modal. */}
                      재시작
                    </PlButton>
                  )}
                  <PlButton
                    variant={resumable ? 'ghost' : 'primary'}
                    size="sm"
                    onClick={onStartNew}
                  >
                    새 작업 시작
                  </PlButton>
                </>
              )}
            </div>
          </div>
        </div>
        {/* The stage phrase labels the flow it counts, so it rides the flow's own
            line. Neutral, not blue: blue declares the card in the head, and a
            second blue tag would read as the same rank. */}
        <div className="mt-[18px] flex items-center justify-between gap-3">
          <span className="text-[14px] font-semibold tracking-[0.01em] text-[var(--pl-text-medium)]">
            Task 실행 흐름
          </span>
          <span className={opsStyles.tag}>{progressPhrase(detail.status, tasks)}</span>
        </div>
      </div>

      {/* flow — every task on the grid canvas, one row + horizontal scroll */}
      <div ref={flowRef} className="r24-canvas r24-hscroll !rounded-none !border-x-0 !border-b-0">
        <div className="r24-line">
          {tasks.map((task, i) => {
            const def = defs.get(task.task_definition);
            return (
              <Fragment key={task.task_id}>
                {i > 0 && <FlowArrow />}
                <RunTaskCard
                  kind={task.kind}
                  operation={task.operation}
                  name={def?.display_name ?? task.task_definition}
                  desc={task.description ?? def?.description}
                  action={task.terraform_action}
                  side={taskInfraSide(task.task_definition, task.kind)}
                  status={task.status}
                  seq={i + 1}
                  retry={task.sequence === retrySeq ? retry : null}
                  onOpen={onOpenTask ? () => onOpenTask(task) : undefined}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Why a start CTA is dead — stated next to the button that would not respond. */

export interface EmptyPipelineCardProps {
  /** 현재 작업 — the section name, rendered inside the card. */
  sectionTitle: string;
  onStart: () => void;
  /** 서비스 측 작업 경고 — `작업 시작` 바로 위: 눌러도 될지를 말한다(잠그지 않는다). */
  serviceWork?: ServiceWorkNoticeData | null;
}

/**
 * Idle state — the same card shell with a centred empty state and the start CTA.
 * There is no start gate (owner 2026-09-11).
 */
export function EmptyPipelineCard({
  sectionTitle,
  onStart,
  serviceWork = null,
}: EmptyPipelineCardProps): ReactElement {
  return (
    <div className={cn(CARD_SHELL, detailStyles.sectionCard.fill)}>
      <SectionHead title={sectionTitle} />
      {/* justify-center: the row's height is set by whichever card is taller, so
          the body centres in whatever space it is given. */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-9 text-center">
        {/* 16px/600 against the section title's 16px/700 primary blue — the
            same size, two ranks apart by weight and colour. */}
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--pl-text-strong)]">
          실행 중인 작업 없음
        </div>
        <p className="mt-2 max-w-[468px] text-[14px] leading-[1.6] text-[var(--pl-text-weak)]">
          작업을 시작하면 Terraform이 실행되어 실제 인프라가 생성되거나 삭제됩니다.
        </p>
        {/* 가운데 정렬된 빈 상태 안에서도 상자는 글 상자다 — 폭을 위 문단에 맞추고
            본문은 왼쪽으로 읽힌다. */}
        <ServiceWorkNotice data={serviceWork} className="mt-5 w-full max-w-[468px]" />
        <PlButton variant="primary" className="mt-5" onClick={onStart}>
          <Icon name="play" size="sm" />
          작업 시작
        </PlButton>
      </div>
    </div>
  );
}
