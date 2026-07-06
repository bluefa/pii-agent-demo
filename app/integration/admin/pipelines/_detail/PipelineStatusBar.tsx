/**
 * PipelineStatusBar — the TARGET-page status strip (design-inventory §2.3.5
 * `.statusbar`): pill · progress · sb-cur · [sb-err] · [취소] · round↗ open;
 * sb-meta = "{TypeTag} #{id} · 레시피 … · 생성 … · 마지막 활동 …".
 *
 * R18 §7: the pipeline-detail page no longer uses this bar — its run/task
 * status moved into the merged flow-card header (PipelineDetailView), so the
 * old `variant` prop is gone. sb-cur branch grammar stays in statusModel.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/integration/admin/pipelines/_components/PipelineProgressBar';
import { PipelineTypeTag } from '@/app/integration/admin/pipelines/_components/PipelineTypeTag';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { RoundNavLink } from '@/app/integration/admin/pipelines/_detail/RoundNavLink';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import {
  canCancel as canCancelFn,
  fmtDateTime,
  progressCount,
  recipeDisplayName,
} from '@/lib/pipeline/format';
import {
  findFailedTask,
  statusCurrentText,
} from '@/app/integration/admin/pipelines/_detail/statusModel';
import type { PipelineDetail, TaskSummary } from '@/lib/pipeline/types';

export interface PipelineStatusBarProps {
  detail: PipelineDetail;
  /** Resolve a task's display name (operation fallback / catalog). */
  resolveName: (task: TaskSummary) => string;
  onCancel: () => void;
  /** Drill-down href to the pipeline detail. */
  openHref?: string;
  className?: string;
}

export function PipelineStatusBar({
  detail,
  resolveName,
  onCancel,
  openHref,
  className,
}: PipelineStatusBarProps): ReactElement {
  const s = detailStyles.statusbar;
  const failed = detail.status === 'FAILED';
  const cancellable = canCancelFn(detail.status, detail.cancel_requested);
  const nonTerminal = detail.status === 'RUNNING' || detail.status === 'PENDING';
  const { done, total } = progressCount(detail.tasks);
  const curText = statusCurrentText(detail.status, detail.next_due_at, detail.tasks, resolveName);
  const failedTask = findFailedTask(detail.tasks);

  return (
    <div className={cn(s.bar, failed && s.barFailed, className)}>
      <div className={s.main}>
        <StatusPill status={detail.status} size="lg" className={failed ? s.pillFailedRing : undefined} />
        <PipelineProgressBar n={done} m={total} status={detail.status} wide />
        <span className={s.cur}>{curText}</span>
        {failedTask?.error_code && (
          <span className={s.err} title={resolveName(failedTask)}>
            {failedTask.error_code}
          </span>
        )}

        <span className={s.actions}>
          {nonTerminal && (
            <PlButton
              variant="danger"
              size="sm"
              disabled={!cancellable}
              onClick={onCancel}
              title={cancellable ? '이 파이프라인을 취소합니다' : '취소 처리 대기 중'}
            >
              취소
            </PlButton>
          )}
          {openHref && <RoundNavLink href={openHref} title="파이프라인 상세로 이동" />}
        </span>
      </div>

      <div className={s.meta}>
        <span className="inline-flex items-center gap-1.5">
          <PipelineTypeTag type={detail.type} /> <span className={s.mono}>#{detail.pipeline_id}</span>
        </span>
        <span className={s.sep}>·</span>
        <span title={detail.recipe_definition ?? ''}>
          레시피 {recipeDisplayName(detail.recipe_definition)}
        </span>
        <span className={s.sep}>·</span>
        <span>생성 {fmtDateTime(detail.created_at)}</span>
        <span className={s.sep}>·</span>
        <span>마지막 활동 {fmtDateTime(detail.last_activity_at)}</span>
      </div>
    </div>
  );
}
