'use client';

/**
 * CurrentPipelineCard — R24 "현재 파이프라인" section body (Figma node 9-2,
 * Header Section 17:3 + Flow Track 9:506). Running: a compact hero card — blue
 * eyebrow, recipe title + #id + RUNNING pill, recipe description, "파이프라인
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
  RunTaskCard,
} from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineDetail, TaskCatalogEntry } from '@/lib/pipeline/types';

/** Blue section eyebrow shared by the running + idle cards (Figma 9:429). */
function Eyebrow(): ReactElement {
  return (
    <div className="text-[12px] font-bold tracking-[-0.01em] text-[var(--pl-primary)]">현재 파이프라인</div>
  );
}

const CARD_SHELL =
  'overflow-hidden rounded-[12px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] text-[var(--pl-text-strong)] shadow-[var(--pl-shadow-xs)]';

export interface CurrentPipelineCardProps {
  detail: PipelineDetail;
  /** task_definition name → catalog entry (display name + description). */
  defs: ReadonlyMap<string, TaskCatalogEntry>;
  onOpenPipeline: () => void;
}

export function CurrentPipelineCard({
  detail,
  defs,
  onOpenPipeline,
}: CurrentPipelineCardProps): ReactElement {
  const label = recipeLabel(detail.recipe_definition);
  const title =
    detail.type === 'CUSTOM' ? 'Custom 파이프라인' : recipeDisplayName(detail.recipe_definition);
  const tasks = [...detail.tasks].sort((a, b) => a.sequence - b.sequence);
  const retry =
    detail.current_fail_count != null && detail.current_max_fail_count != null
      ? `시도 ${detail.current_fail_count + 1} / ${detail.current_max_fail_count}`
      : null;

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
              파이프라인 현황 보기
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
                  status={task.status}
                  seq={i + 1}
                  retry={task.status === 'IN_PROGRESS' ? retry : null}
                />
              </Fragment>
            );
          })}
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
          실행 중인 파이프라인이 없습니다.
        </div>
        <p className="mt-2 max-w-[468px] text-[15px] leading-[1.6] text-[var(--pl-text-weak)]">
          파이프라인을 시작해 보세요. 설치·삭제·Custom 흐름이 Task 단위로 실행되고, 진행 상황을 여기서
          바로 볼 수 있어요.
        </p>
        <PlButton variant="primary" className="mt-5" onClick={onStart}>
          <Icon name="play" size="sm" />
          파이프라인 시작
        </PlButton>
      </div>
    </div>
  );
}
