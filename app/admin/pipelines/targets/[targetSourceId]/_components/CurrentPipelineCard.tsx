'use client';

/**
 * CurrentPipelineCard — R24 "현재 파이프라인" section body (Figma node 9-2 cell
 * A/B). Running: a drawer-grammar card — head (type tile + recipe title +
 * status pill + type pill + #id, actions: 중단 + 파이프라인 현황 보기 ↗) →
 * 진행 기록 kv rows → the current-task strip (prev/cur/next R24 nodes on the
 * 16px grid canvas, "+N개 남음" tail). Idle: a dashed empty card with the
 * start CTA and the 마지막 실행 line. Data (detail polling, catalog map,
 * cancel flow) stays in TargetDetailView — this file is presentation only.
 */
import { Fragment, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { StatusPill } from '@/app/admin/pipelines/_components/StatusPill';
import { canCancel, fmtDateTime, recipeDisplayName, recipeLabel } from '@/lib/pipeline/format';
import {
  FlowArrow,
  R24_CSS,
  R24TaskNode,
  TypePill,
  TypeTile,
  type R24TaskNodeProps,
} from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineDetail, PipelineSummary, TaskCatalogEntry, TaskSummary } from '@/lib/pipeline/types';

/** Elapsed minutes/hours since `iso` — the 경과 kv value ('14분', '2시간 5분'). */
export function fmtElapsed(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '-';
  const min = Math.max(0, Math.floor((now - then) / 60_000));
  if (min < 60) return `${min}분`;
  const rest = min % 60;
  return rest ? `${Math.floor(min / 60)}시간 ${rest}분` : `${Math.floor(min / 60)}시간`;
}

/** Task-status tally line — '완료 3 · 실행 중 1 · 대기 3' (zero buckets dropped). */
export function taskTally(tasks: readonly TaskSummary[]): string {
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const running = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'READY').length;
  const failed = tasks.filter((t) => t.status === 'FAILED').length;
  const rest = tasks.length - done - running - failed;
  const parts: string[] = [];
  if (done) parts.push(`완료 ${done}`);
  if (running) parts.push(`실행 중 ${running}`);
  if (failed) parts.push(`실패 ${failed}`);
  if (rest) parts.push(`대기 ${rest}`);
  return parts.length ? parts.join(' · ') : '-';
}

interface StripNode {
  task: TaskSummary;
  state: R24TaskNodeProps['state'];
}

/** prev/cur/next window around the current task (+ count of what's beyond). */
export function stripWindow(
  tasks: readonly TaskSummary[],
  currentSequence: number | null,
): { nodes: StripNode[]; rest: number } {
  if (!tasks.length) return { nodes: [], rest: 0 };
  const ordered = [...tasks].sort((a, b) => a.sequence - b.sequence);
  const icur = Math.max(
    0,
    ordered.findIndex((t) => t.sequence === currentSequence),
  );
  const from = Math.max(0, icur - 1);
  const to = Math.min(ordered.length, icur + 2);
  const nodes = ordered.slice(from, to).map((task, i) => ({
    task,
    state: from + i < icur ? ('dim' as const) : from + i === icur ? ('cur' as const) : ('pend' as const),
  }));
  return { nodes, rest: ordered.length - to };
}

export interface CurrentPipelineCardProps {
  detail: PipelineDetail;
  /** task_definition name → catalog entry (display name + description). */
  defs: ReadonlyMap<string, TaskCatalogEntry>;
  onCancel: () => void;
  onOpenPipeline: () => void;
}

export function CurrentPipelineCard({
  detail,
  defs,
  onCancel,
  onOpenPipeline,
}: CurrentPipelineCardProps): ReactElement {
  const label = recipeLabel(detail.recipe_definition);
  const title =
    detail.type === 'CUSTOM' ? 'Custom 파이프라인' : recipeDisplayName(detail.recipe_definition);
  const { nodes, rest } = stripWindow(detail.tasks, detail.current_task_sequence);
  const retry =
    detail.current_fail_count != null && detail.current_max_fail_count != null
      ? `시도 ${detail.current_fail_count + 1} / ${detail.current_max_fail_count}`
      : null;

  return (
    <div className="mt-3.5 rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-xs)] overflow-hidden">
      <style>{R24_CSS}</style>

      {/* head — type tile + recipe hero title + badges, actions right */}
      <div className="flex items-start gap-4 px-6 pt-5 pb-[18px]">
        <TypeTile type={detail.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <b className="text-[18px] font-bold tracking-[-0.018em] text-[var(--pl-text-strong)]">{title}</b>
            <StatusPill status={detail.status} />
            <TypePill type={detail.type} />
            <span className="text-[13px] font-medium text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]">
              #{detail.pipeline_id}
            </span>
          </div>
          {label?.desc ? (
            <p className="mt-[7px] max-w-[760px] text-[13.5px] leading-[1.6] text-[var(--pl-text-weak)]">
              {label.desc}
            </p>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-3.5 pt-1">
          {canCancel(detail.status, detail.cancel_requested) && (
            <PlButton variant="danger" size="sm" onClick={onCancel}>
              중단
            </PlButton>
          )}
          <button
            type="button"
            className={cn(pipelineStyles.text.link, 'inline-flex items-center gap-1 text-[13px] font-semibold hover:underline')}
            onClick={onOpenPipeline}
          >
            파이프라인 현황 보기
            <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* 진행 기록 — drawer-grammar kv rows (label weak / value strong, right) */}
      <div className="flex max-w-[560px] flex-col gap-[11px] border-t border-[var(--pl-gray-100)] px-6 pt-[18px] pb-5">
        <div className="mb-[3px] text-[15px] font-bold tracking-[-0.01em] text-[var(--pl-text-strong)]">
          진행 기록
        </div>
        <Kv k="시작" v={fmtDateTime(detail.created_at)} />
        <Kv k="경과" v={fmtElapsed(detail.created_at)} />
        <div className="flex items-center justify-between gap-3">
          <span className="flex-none text-[13.5px] text-[var(--pl-text-weak)]">진행 단계</span>
          <span className="flex items-center gap-2.5">
            <span className="h-1.5 w-[220px] flex-none overflow-hidden rounded-full bg-[var(--pl-gray-100)]">
              <span
                className="block h-full rounded-full bg-[var(--pl-primary)]"
                style={{
                  width: `${detail.total_task_count > 0 ? Math.round((detail.done_task_count / detail.total_task_count) * 100) : 0}%`,
                }}
              />
            </span>
            <span className="text-[13.5px] font-semibold tabular-nums text-[var(--pl-text-strong)]">
              {detail.done_task_count} / {detail.total_task_count}
            </span>
          </span>
        </div>
        <Kv k="Task 상태" v={taskTally(detail.tasks)} />
      </div>

      {/* 현재 TASK — R24 node strip on the grid canvas */}
      {nodes.length > 0 && (
        <div className="r24-canvas !rounded-none !border-x-0 !border-b-0 px-6 pt-[18px] pb-[22px]">
          <div className="mb-3.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--pl-text-faint)]">
            현재 TASK — 앞뒤 단계
          </div>
          <div className="flex items-center gap-3 overflow-x-auto">
            {nodes.map(({ task, state }, i) => {
              const def = defs.get(task.task_definition);
              return (
                <Fragment key={task.task_id}>
                  {i > 0 && <FlowArrow />}
                  <R24TaskNode
                    kind={task.kind}
                    name={def?.display_name ?? task.task_definition}
                    desc={task.description ?? def?.description}
                    state={state}
                    footer={
                      <>
                        <StatusPill status={task.status} />
                        {state === 'cur' && retry ? (
                          <span className="text-[12px] text-[var(--pl-text-faint)]">{retry}</span>
                        ) : null}
                      </>
                    }
                  />
                </Fragment>
              );
            })}
            {rest > 0 && (
              <span className="ml-0.5 flex-none text-[12px] text-[var(--pl-text-faint)]">+ {rest}개 남음</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-none text-[13.5px] text-[var(--pl-text-weak)]">{k}</span>
      <span className="text-right text-[13.5px] tabular-nums text-[var(--pl-text-strong)]">{v}</span>
    </div>
  );
}

export interface EmptyPipelineCardProps {
  /** Latest terminal run (null = never ran). */
  last: PipelineSummary | null;
  onStart: () => void;
}

/** Idle state — dashed card with the start CTA + the 마지막 실행 line. */
export function EmptyPipelineCard({ last, onStart }: EmptyPipelineCardProps): ReactElement {
  return (
    <div className="mt-3.5 flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-6 pt-11 pb-10 text-center">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--pl-gray-100)] text-[var(--pl-text-weak)]">
        <Icon name="flow" size="lg" strokeWidth={2} />
      </span>
      <div className="text-[15px] font-bold text-[var(--pl-text-strong)]">실행 중인 파이프라인이 없습니다</div>
      <p className="mt-1.5 max-w-[440px] text-[13px] leading-[1.65] text-[var(--pl-text-weak)]">
        파이프라인을 시작하면 설치·삭제·Custom 흐름이 Task 단위로 실행되고, 이 자리에서 진행 상황을 바로
        볼 수 있어요.
      </p>
      <PlButton variant="primary" className="mt-[18px]" onClick={onStart}>
        <Icon name="play" size="sm" />
        파이프라인 시작
      </PlButton>
      {last && (
        <div className="mt-3.5 flex items-center gap-[7px] text-[12px] tabular-nums text-[var(--pl-text-faint)]">
          마지막 실행
          <StatusPill status={last.status} />
          <span>
            #{last.pipeline_id}{' '}
            {last.type === 'CUSTOM' ? 'Custom 파이프라인' : recipeDisplayName(last.recipe_definition)} ·{' '}
            {fmtDateTime(last.last_activity_at)} {last.status === 'DONE' ? '완료' : '종료'}
          </span>
        </div>
      )}
    </div>
  );
}
