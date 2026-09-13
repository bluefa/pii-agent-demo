'use client';

/**
 * 작업 줄 — the latest run on this target, one line under the 확정 정보 card head.
 *
 * The run CARD (task flow · 중단 · 재시작) lives in the 인프라 작업 tab only (owner 09-11);
 * this line says what is running or what last ran, and points at the run's own page. It
 * carries any type: a running 설치 or 삭제 locks this tab's doors just as 재확정 does.
 *
 * Box = the notice family (12px radius · 14/12 inset · 14/600 name). A live run takes the
 * info wash + a 「파이프라인 작업 진행 중」 lead; a finished run sits plain. No run at all (204) → the caller renders nothing: an absent run is not news.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { FlowStatusPill } from '@/app/admin/pipelines/_detail/r24Task';
import { RequesterTag } from '@/app/admin/pipelines/_detail/RequesterTag';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { fmtDateTimeShortSec, isLivePipeline, recipeDisplayName, typeKo } from '@/lib/pipeline/format';
import type { PipelineSummary } from '@/lib/pipeline/types';

export interface RunLineProps {
  run: PipelineSummary;
  onOpen: () => void;
  className?: string;
}

export function RunLine({ run, onOpen, className }: RunLineProps): ReactElement {
  const live = isLivePipeline(run.status);
  const name = run.recipe_definition ? recipeDisplayName(run.recipe_definition) : typeKo(run.type);
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border px-3.5 py-3',
        // A live run wears the info wash so the box itself says "something is happening";
        // a finished one sits on the card ground (owner 2026-09-13).
        live
          ? 'border-[var(--pl-info-border)] bg-[var(--pl-info-bg)]'
          : 'border-[var(--pl-border)] bg-[var(--pl-bg-card)]',
        className,
      )}
      data-testid="run-line"
    >
      {live && (
        <span className="text-[14px] font-semibold text-[var(--pl-info-text)]">파이프라인 작업 진행 중</span>
      )}
      <FlowStatusPill status={run.status} />
      <span className="text-[14px] font-semibold text-[var(--pl-text-strong)]">
        {name} #{run.pipeline_id}
      </span>
      <span className="flex items-center gap-2 text-[12px] text-[var(--pl-text-medium)] tabular-nums">
        <span>
          Task {run.done_task_count}/{run.total_task_count}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {live
            ? `${fmtDateTimeShortSec(run.created_at)} 시작`
            : `${fmtDateTimeShortSec(run.last_activity_at)} 종료`}
        </span>
        <RequesterTag requestedBy={run.requested_by} />
      </span>
      <button type="button" className={cn(opsStyles.detailLink, 'ml-auto')} onClick={onOpen}>
        상세 보기
        <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
      </button>
    </div>
  );
}
