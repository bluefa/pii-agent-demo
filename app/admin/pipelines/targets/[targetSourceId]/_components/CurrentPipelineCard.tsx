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
import { recipeDisplayName, recipeLabel } from '@/lib/pipeline/format';
import {
  FlowArrow,
  FlowStatusPill,
  R24_CSS,
  R24_RUN_CSS,
  RestartBadge,
  RunTaskCard,
} from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineDetail, TaskCatalogEntry } from '@/lib/pipeline/types';

/** Blue section eyebrow shared by the running / failed / idle cards (Figma 9:429). */
function Eyebrow({ label = '현재 작업' }: { label?: string }): ReactElement {
  return (
    <div className="text-[12px] font-bold tracking-[-0.01em] text-[var(--pl-primary)]">{label}</div>
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
}

export function CurrentPipelineCard({
  detail,
  defs,
  onOpenPipeline,
  onOpenOrigin,
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
            </div>
            {label?.desc ? (
              <p className="mt-1.5 max-w-[760px] text-[14px] leading-[1.55] text-[var(--pl-text-weak)]">
                {label.desc}
              </p>
            ) : null}
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
        <div className="mt-4 flex items-center gap-2.5">
          <PlButton variant="primary" onClick={onRestart}>
            <Icon name="play" size="sm" />
            {/* Just the verb: the line above already says where it stopped, and
                the modal names the resume point. FAILED/CANCELLED wording no
                longer has to be branched here. */}
            재시작
          </PlButton>
          <PlButton variant="ghost" onClick={onStartNew}>
            새 작업 시작
          </PlButton>
        </div>
      </div>
    </div>
  );
}

export interface EmptyPipelineCardProps {
  onStart: () => void;
}

/** Idle state — the same card shell with a centered empty state + start CTA. */
export function EmptyPipelineCard({ onStart }: EmptyPipelineCardProps): ReactElement {
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
        <PlButton variant="primary" className="mt-5" onClick={onStart}>
          <Icon name="play" size="sm" />
          작업 시작
        </PlButton>
      </div>
    </div>
  );
}
