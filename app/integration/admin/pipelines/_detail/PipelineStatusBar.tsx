/**
 * PipelineStatusBar — the shared status strip (design-inventory §2.3.5 / §2.4.5
 * `.statusbar`). One component, two variants:
 *  - 'target': pill · progress · sb-cur · [sb-err] · [취소] · round↗ open;
 *    sb-meta = "{type} #{id} · 레시피 … · 생성 … · 마지막 활동 …" (always).
 *  - 'pipeline': pill · [취소 요청됨 ftag] · progress · sb-cur · [sb-err] ·
 *    [다음 실행 meta] · [lock meta] · 파이프라인 취소; sb-meta = leased · 스케줄 지연
 *    (only when RUNNING/PENDING).
 * Both drive from a PipelineDetail; sb-cur branch grammar is in statusModel.
 */
import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { StatusPill } from '@/app/integration/admin/pipelines/_components/StatusPill';
import { PipelineProgressBar } from '@/app/integration/admin/pipelines/_components/PipelineProgressBar';
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
  variant: 'target' | 'pipeline';
  /** Resolve a task's display name (operation on target; catalog/detail on pipeline). */
  resolveName: (task: TaskSummary) => string;
  /** Pipeline variant only: retry suffix for the current task (fail_count>0). */
  retryFor?: (task: TaskSummary) => string | null;
  onCancel: () => void;
  /** Target variant: drill-down href to the pipeline detail. */
  openHref?: string;
  className?: string;
}

export function PipelineStatusBar({
  detail,
  variant,
  resolveName,
  retryFor,
  onCancel,
  openHref,
  className,
}: PipelineStatusBarProps): ReactElement {
  const s = detailStyles.statusbar;
  const failed = detail.status === 'FAILED';
  const cancellable = canCancelFn(detail.status, detail.cancel_requested);
  const nonTerminal = detail.status === 'RUNNING' || detail.status === 'PENDING';
  const { done, total } = progressCount(detail.tasks);
  const curText = statusCurrentText(detail.status, detail.next_due_at, detail.tasks, resolveName, retryFor);
  const failedTask = findFailedTask(detail.tasks);

  return (
    <div className={cn(s.bar, failed && s.barFailed, className)}>
      <div className={s.main}>
        <StatusPill status={detail.status} size="lg" className={failed ? s.pillFailedRing : undefined} />
        {variant === 'pipeline' && detail.cancel_requested && (
          <span
            className={detailStyles.ftag.ext}
            title="cancel_requested=true — 다음 실행 사이클에 취소가 반영됩니다"
          >
            취소 요청됨
          </span>
        )}
        <PipelineProgressBar n={done} m={total} status={detail.status} wide />
        <span className={s.cur}>{curText}</span>
        {failedTask?.error_code && (
          <span className={s.err} title={`seq ${failedTask.sequence} · ${resolveName(failedTask)}`}>
            {failedTask.error_code}
          </span>
        )}

        <span className={s.actions}>
          {variant === 'pipeline' && detail.status === 'RUNNING' && detail.next_due_at && (
            <span className={s.metaItem} title="next_due_at — 다음 폴링/실행 예정 시각">
              다음 실행 {fmtDateTime(detail.next_due_at)}
            </span>
          )}
          {variant === 'pipeline' &&
            (detail.cancel_requested ? (
              <span className={s.metaItem}>취소 처리 대기 중</span>
            ) : !cancellable ? (
              <span className={s.metaItem}>진행·대기 중만 취소 가능</span>
            ) : null)}

          {variant === 'target'
            ? nonTerminal && (
                <PlButton
                  variant="danger"
                  size="sm"
                  disabled={!cancellable}
                  onClick={onCancel}
                  title={cancellable ? '이 파이프라인을 취소합니다' : '취소 처리 대기 중'}
                >
                  취소
                </PlButton>
              )
            : (
              <PlButton variant="danger" size="sm" disabled={!cancellable} onClick={onCancel}>
                파이프라인 취소
              </PlButton>
            )}

          {variant === 'target' && openHref && (
            <RoundNavLink href={openHref} title="파이프라인 상세로 이동" />
          )}
        </span>
      </div>

      {variant === 'target' && (
        <div className={s.meta}>
          <span>
            {detail.type} <span className={s.mono}>#{detail.pipeline_id}</span>
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
      )}

      {variant === 'pipeline' && nonTerminal && (
        <div className={s.meta}>
          <span title="leased — 워커가 이 run을 점유하고 실행 중인지">
            leased {detail.leased ? '예 — 워커 실행 중' : '아니오'}
          </span>
          <span className={s.sep}>·</span>
          <span title="due_lag — next_due_at 대비 실제 실행 지연">
            스케줄 지연 {detail.due_lag_millis ?? 0} ms{(detail.due_lag_millis || 0) > 1000 ? ' ⚠️' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
