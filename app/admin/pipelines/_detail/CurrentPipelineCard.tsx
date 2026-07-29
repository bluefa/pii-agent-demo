'use client';

/**
 * CurrentPipelineCard — R24 "현재 작업" section body (Figma node 9-2,
 * Header Section 17:3 + Flow Track 9:506). Running: a compact hero card — blue
 * eyebrow, recipe title + #id + RUNNING pill, recipe description, "작업
 * 현황 보기 ↗" link, then a "Task 실행 흐름" label over the 16px grid canvas
 * that lays out EVERY task as a RunTaskCard (tile + status corner + status
 * pill) in one horizontally-scrolling row. Detailed progress lives on the
 * 현황 page the link points to. Idle: the same shell with a centered empty
 * state and the start CTA. Data (detail polling, catalog map, cancel flow)
 * stays in TargetDetailView — this file is presentation only.
 */
import { Fragment, useEffect, useRef, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { canCancel, recipeDisplayName, recipeLabel, taskInfraSide } from '@/lib/pipeline/format';
import {
  FlowArrow,
  FlowStatusPill,
  R24_CSS,
  R24_RUN_CSS,
  RestartBadge,
  RunTaskCard,
} from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineDetail, TaskCatalogEntry, TerraformAction } from '@/lib/pipeline/types';

/** Blue section eyebrow shared by the running / failed / idle cards (Figma 9:429). */
function Eyebrow({ label = '현재 작업' }: { label?: string }): ReactElement {
  return (
    <div className="text-[12px] font-bold tracking-[-0.01em] text-[var(--pl-primary)]">{label}</div>
  );
}

const IMPACT_CHIP =
  'rounded-[5px] border px-2 py-[3px] text-[11.5px] font-bold tracking-[0.02em] [font-family:var(--pl-font-mono)] whitespace-nowrap';

/**
 * 이 작업이 인프라에 무엇을 하는가 — derived from the run's `terraform_action`s.
 *
 * A fixed caution line ("이 작업은 인프라를 변경합니다") stops being read after
 * the second visit. Counting what THIS run actually does keeps the line
 * informative every time, and lets the tone escalate ONLY when a DESTROY is
 * involved — so a red note still means something when it appears.
 *
 * Returns null for a run with no terraform task at all (CONDITION_CHECK only):
 * that run does not touch infrastructure, and saying it does would be a lie.
 */
function TerraformImpactNote({ detail }: { detail: PipelineDetail }): ReactElement | null {
  const counts: Record<TerraformAction, number> = { PLAN: 0, APPLY: 0, DESTROY: 0 };
  for (const task of detail.tasks) {
    if (task.terraform_action) counts[task.terraform_action] += 1;
  }
  if (counts.PLAN + counts.APPLY + counts.DESTROY === 0) return null;

  const interrupted = detail.status === 'FAILED' || detail.status === 'CANCELLED';
  const destructive = counts.DESTROY > 0;
  // Two tones only: neutral for anything that builds, red for anything that
  // destroys or broke. An APPLY-blue middle tier just made the note a third
  // color on a screen that already had too many.
  const tone =
    destructive || interrupted
      ? 'border-[1.5px] border-[var(--pl-err)] bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]'
      : 'border border-[var(--pl-border)] bg-[var(--pl-gray-50)] text-[var(--pl-text-medium)]';

  return (
    <div
      className={cn(
        'mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[9px] px-4 py-3 text-[13.5px] leading-[1.5]',
        tone,
      )}
    >
      <Icon name="warn-tri" size="md" className="flex-none" />
      <span className="font-semibold">
        {interrupted
          ? '작업이 중단되어 인프라가 부분 상태일 수 있습니다.'
          : destructive
            ? '이 작업은 실제 인프라를 삭제합니다'
            : '이 작업은 실제 인프라를 변경합니다'}
      </span>
      <span className="ml-auto flex flex-wrap gap-1.5">
        {counts.DESTROY > 0 && (
          <span
            className={cn(
              IMPACT_CHIP,
              'border-[var(--pl-err-solid)] bg-[var(--pl-err-solid)] text-[var(--pl-white)]',
            )}
          >
            DESTROY {counts.DESTROY}건
          </span>
        )}
        {counts.APPLY > 0 && (
          <span className={cn(IMPACT_CHIP, 'border-current bg-[var(--pl-bg-card)]')}>
            APPLY {counts.APPLY}건
          </span>
        )}
        {counts.PLAN > 0 && (
          <span className={cn(IMPACT_CHIP, 'border-current bg-[var(--pl-bg-card)]')}>
            PLAN {counts.PLAN}건
          </span>
        )}
      </span>
    </div>
  );
}

const CARD_SHELL =
  'overflow-hidden rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] shadow-[var(--pl-shadow-xs)]';

/** 중단/실패 지점의 Task 이름 태그 (LastRunFailedCard) — 중립 톤. */
const STOP_TAG =
  'inline-flex items-center rounded-[6px] border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-[7px] py-[3px] align-[1px] text-[13px] font-semibold text-[var(--pl-text-strong)]';

export interface CurrentPipelineCardProps {
  detail: PipelineDetail;
  /** task_definition name → catalog entry (display name + description). */
  defs: ReadonlyMap<string, TaskCatalogEntry>;
  onOpenPipeline: () => void;
  /** Opens the ORIGIN run when this one is a restart (restart badge). */
  onOpenOrigin?: (originPipelineId: number) => void;
  /** Opens the 작업 중단 confirmation. Never gated: stopping a run in flight is
   *  always allowed, whatever else on the page is blocked. */
  onCancel: () => void;
}

export function CurrentPipelineCard({
  detail,
  defs,
  onOpenPipeline,
  onOpenOrigin,
  onCancel,
}: CurrentPipelineCardProps): ReactElement {
  const label = recipeLabel(detail.recipe_definition);
  const title =
    detail.type === 'CUSTOM' ? 'Custom 작업' : recipeDisplayName(detail.recipe_definition);
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
  const currentSeq = tasks.find((t) => t.status === 'IN_PROGRESS')?.sequence ?? null;
  useEffect(() => {
    const track = flowRef.current;
    const el = track?.querySelector<HTMLElement>('.rtc.cur');
    if (!track || !el) return;
    const c = track.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const delta = e.left - c.left - (track.clientWidth - el.clientWidth) / 2;
    track.scrollBy({
      left: delta,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [currentSeq, detail.pipeline_id]);

  return (
    <div className={CARD_SHELL}>
      <style>{R24_CSS + R24_RUN_CSS}</style>

      {/* header — eyebrow, title row + status, description, actions, flow label */}
      <div className="px-6 pt-4 pb-1">
        <Eyebrow />
        <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <b className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--pl-text-strong)]">
                {title}
              </b>
              <span className="text-[13px] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]">
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
              {detail.cancel_requested && (
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
          </div>
          <div className="flex flex-none items-center gap-3 pt-0.5">
            <button
              type="button"
              className={cn(
                pipelineStyles.text.link,
                'inline-flex items-center gap-1 text-[13px] font-semibold hover:underline',
              )}
              onClick={onOpenPipeline}
            >
              작업 현황 보기
              <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
            </button>
            <PlButton
              variant="danger"
              size="sm"
              onClick={onCancel}
              disabled={!canCancel(detail.status, detail.cancel_requested)}
            >
              <Icon name="stop" size="sm" />
              작업 중단
            </PlButton>
          </div>
        </div>
        <TerraformImpactNote detail={detail} />
        <div className="mt-[18px] text-[14px] font-semibold tracking-[0.01em] text-[var(--pl-text-medium)]">
          Task 실행 흐름
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
                  name={def?.display_name ?? task.task_definition}
                  desc={task.description ?? def?.description}
                  action={task.terraform_action}
                  side={taskInfraSide(task.task_definition)}
                  status={task.status}
                  seq={i + 1}
                  retry={task.sequence === retrySeq ? retry : null}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface LastRunFailedCardProps {
  detail: PipelineDetail;
  /** task_definition name → catalog entry (display name + description). */
  defs: ReadonlyMap<string, TaskCatalogEntry>;
  onRestart: () => void;
  onStartNew: () => void;
  onOpenPipeline: () => void;
  /** Opens the ORIGIN run when this failed run was itself a restart. */
  onOpenOrigin?: (originPipelineId: number) => void;
  /** Disables both CTAs and states why — see TargetPipelineSections. */
  blockedReason?: string | null;
}

/**
 * Terminal FAILED/CANCELLED latest run (restart-design §8.1) — the third state
 * of the "현재 작업" section. Before this, a failed run fell back to the empty
 * card and the failure context vanished; here the failure stays on screen WITH
 * the action that answers it. The restart CTA renders only in this branch —
 * that IS the frontend half of decision 5's gating (live → cancel only, DONE → start only).
 */
export function LastRunFailedCard({
  detail,
  defs,
  onRestart,
  onStartNew,
  onOpenPipeline,
  onOpenOrigin,
  blockedReason = null,
}: LastRunFailedCardProps): ReactElement {
  const title =
    detail.type === 'CUSTOM' ? 'Custom 작업' : recipeDisplayName(detail.recipe_definition);
  const tasks = [...detail.tasks].sort((a, b) => a.sequence - b.sequence);
  // The stop point: the failed task, else the first task that never completed
  // (a cancelled run's in-flight task). Same rule the server resumes from.
  const stopped = tasks.find((t) => t.status === 'FAILED') ?? tasks.find((t) => t.status !== 'DONE');
  const stoppedName = stopped
    ? defs.get(stopped.task_definition)?.display_name ?? stopped.task_definition
    : null;

  return (
    <div className={CARD_SHELL}>
      <div className="px-6 pt-4 pb-5">
        <Eyebrow label="최근 작업" />
        <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <b className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--pl-text-strong)]">
                {title}
              </b>
              <span className="text-[13px] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]">
                #{detail.pipeline_id}
              </span>
              <FlowStatusPill status={detail.status} className="!px-2.5 !py-1 !text-[12px]" />
              {detail.origin_pipeline_id != null && (
                <RestartBadge
                  originPipelineId={detail.origin_pipeline_id}
                  onClick={onOpenOrigin ? () => onOpenOrigin(detail.origin_pipeline_id as number) : undefined}
                />
              )}
            </div>
            {/* Two facts, two lines, two weights. They used to be one 14px line
                glued by an em dash, which flattened "어디서 멈췄나"(actionable)
                and "얼마나 갔나"(context) into the same rank. The stop point
                leads because it is what the restart CTA acts on. */}
            <p className="mt-1.5 text-[14px] font-medium leading-[1.55] text-[var(--pl-text-strong)]">
              {stoppedName ? (
                <>
                  {/* The task name is a value, not prose — a neutral tag reads it
                      as one unit. The failure signal stays on the status pill and
                      the error-code chip; a red name as well was too loud. */}
                  <span className={STOP_TAG}>{stoppedName}</span>
                  {detail.status === 'FAILED' ? '에서 실패했습니다.' : '에서 중단됐습니다.'}
                </>
              ) : detail.status === 'FAILED' ? (
                '작업이 실패했습니다.'
              ) : (
                '작업이 중단됐습니다.'
              )}
              {stopped?.error_code && (
                <code className="ml-2 rounded bg-[var(--pl-err-bg)] px-1.5 py-0.5 align-middle text-[12px] font-medium text-[var(--pl-err-text)] [font-family:var(--pl-font-mono)]">
                  {stopped.error_code}
                </code>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-[1.5] text-[var(--pl-text-weak)]">
              전체 {detail.total_task_count}단계 중 {detail.done_task_count}단계를 완료했습니다.
            </p>
          </div>
          <div className="flex flex-none items-center pt-0.5">
            <button
              type="button"
              className={cn(
                pipelineStyles.text.link,
                'inline-flex items-center gap-1 text-[13px] font-semibold hover:underline',
              )}
              onClick={onOpenPipeline}
            >
              작업 현황 보기
              <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <TerraformImpactNote detail={detail} />
        <div className="mt-4 flex items-center gap-2.5">
          <PlButton variant="primary" onClick={onRestart} disabled={blockedReason != null}>
            <Icon name="play" size="sm" />
            {/* Just the verb: the line above already says where it stopped, and
                the modal names the resume point. FAILED/CANCELLED wording no
                longer has to be branched here. */}
            재시작
          </PlButton>
          <PlButton variant="ghost" onClick={onStartNew} disabled={blockedReason != null}>
            새 작업 시작
          </PlButton>
        </div>
        {blockedReason && <BlockedReason reason={blockedReason} className="mt-2.5" />}
      </div>
    </div>
  );
}

/** Why a start CTA is dead — stated next to the button that would not respond. */
function BlockedReason({
  reason,
  className,
}: {
  reason: string;
  className?: string;
}): ReactElement {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--pl-warn-text)]',
        className,
      )}
    >
      <Icon name="ban" size="sm" />
      {reason}
    </p>
  );
}

export interface EmptyPipelineCardProps {
  onStart: () => void;
  /** Disables the CTA and states why — see TargetPipelineSections. */
  blockedReason?: string | null;
}

/** Idle state — the same card shell with a centered empty state + start CTA. */
export function EmptyPipelineCard({
  onStart,
  blockedReason = null,
}: EmptyPipelineCardProps): ReactElement {
  const blocked = blockedReason != null;
  return (
    <div className={CARD_SHELL}>
      <div className="px-6 pt-4">
        <Eyebrow />
      </div>
      <div className="flex flex-col items-center px-6 pb-10 pt-5 text-center">
        <span className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[var(--pl-gray-50)] text-[var(--pl-text-faint)]">
          <Icon name="inbox" size="lg" strokeWidth={1.8} />
        </span>
        <div className="text-[20px] font-medium tracking-[-0.01em] text-[var(--pl-text-strong)]">
          실행 중인 작업이 없습니다.
        </div>
        <p className="mt-2 max-w-[468px] text-[15px] leading-[1.6] text-[var(--pl-text-weak)]">
          작업을 시작해 보세요. 설치·삭제·Custom 흐름이 여러 단계로 실행되고, 진행 상황을 여기서
          바로 볼 수 있어요.
        </p>
        {/* Pre-warning, in info blue: nothing is wrong yet — this states what the
            button will do. Amber belongs to the 확정 정보 gate, red to real
            failures, so neither is borrowed here. Suppressed when the CTA is
            already blocked; the reason line below says the operative thing. */}
        {!blocked && (
          <p className="mt-2.5 max-w-[468px] text-[14px] font-semibold leading-[1.6] text-[var(--pl-info-text)]">
            작업을 시작하면 Terraform이 실행되어 실제 인프라가 생성되거나 삭제됩니다.
          </p>
        )}
        <PlButton variant="primary" className="mt-5" onClick={onStart} disabled={blocked}>
          <Icon name="play" size="sm" />
          작업 시작
        </PlButton>
        {blockedReason && <BlockedReason reason={blockedReason} className="mt-2.5" />}
      </div>
    </div>
  );
}
