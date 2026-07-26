'use client';

/**
 * PipelineTab — 운영 콘솔 파이프라인 탭 (design/pipeline/ops-target-source-tabs.html
 * `tabPipeline`): the target's latest orchestrator run as a Task flow strip plus
 * a paged run history. Condensed replica of the R24 target-detail page — live
 * polling, the Task drawer and the start flow stay there (this tab reloads on
 * demand and links out via passRoutes.pipelines.target/pipeline).
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { JobKindTag } from '@/app/admin/pipelines/_components/JobKindTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { fmtDateTime, isLivePipeline, recipeDisplayName, recipeLabel } from '@/lib/pipeline/format';
import { passRoutes } from '@/lib/routes';
import {
  getLatestPipelineByTarget,
  getPipeline,
  getTaskDefinitions,
  listPipelinesByTarget,
} from '@/app/lib/api/pipeline';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type {
  PipelineDetail,
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  SpringPage,
  TaskKind,
  TaskStatus,
  TaskSummary,
} from '@/lib/pipeline/types';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const PAGE_SIZE = 5;

/** Run-level status labels — DONE reads 성공 for a whole pipeline. */
const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  PENDING: '대기',
  RUNNING: '진행 중',
  DONE: '성공',
  FAILED: '실패',
  CANCELLED: '취소',
};

/** Task-level status labels — DONE reads 완료 for a single step. */
const TASK_LABEL: Record<TaskStatus, string> = {
  BLOCKED: '대기',
  READY: '대기',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  FAILED: '실패',
  CANCELLED: '취소',
};

const TYPE_TONE: Record<PipelineType, string> = {
  INSTALL: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
  DELETE: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  CUSTOM: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
};

/** Corner badge — the task's execution mechanism (TaskKind). */
const KIND_BADGE: Record<TaskKind, { label: string; tone: string }> = {
  TERRAFORM_JOB: { label: 'TF', tone: 'bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]' },
  CONDITION_CHECK: { label: 'COND', tone: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]' },
};

/** Ops dot pill — theme status tone + Korean label (mockup `.pill`). */
function OpsPill({
  status,
  label,
}: {
  status: PipelineStatus | TaskStatus;
  label: string;
}): ReactElement {
  const { pill } = pipelineStyles;
  return (
    <span className={cn(pill.base, pill.md, pill.tone[status])}>
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

/** 200px Task node in the flow strip — corner kind badge + status + TF action. */
function TaskRunCard({
  task,
  name,
  retry,
  current,
}: {
  task: TaskSummary;
  name: string;
  retry: string | null;
  current: boolean;
}): ReactElement {
  const badge = KIND_BADGE[task.kind];
  return (
    <div
      className={cn(
        'relative w-[200px] flex-none rounded-[10px] border bg-[var(--pl-bg-card)] px-3.5 pb-3.5 pt-3',
        current
          ? 'border-[var(--pl-primary)] shadow-[0_0_0_3px_var(--pl-primary-ring)]'
          : 'border-[var(--pl-border)]',
      )}
    >
      <span
        className={cn(
          'absolute -right-px -top-px rounded-[0_10px_0_8px] px-2 py-0.5 text-[10px] font-bold [font-family:var(--pl-font-mono)]',
          badge.tone,
        )}
      >
        {badge.label}
      </span>
      <div className="mt-1 line-clamp-2 pr-9 text-[13px] font-semibold leading-[1.35] text-[var(--pl-text-strong)]">
        {name}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]">
        seq {task.sequence}
        {retry ? ` · ${retry}` : ''}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <OpsPill status={task.status} label={TASK_LABEL[task.status]} />
        <JobKindTag action={task.terraform_action} />
      </div>
    </div>
  );
}

export interface PipelineTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function PipelineTab({ targetSourceId }: PipelineTabProps): ReactElement {
  const [run, setRun] = useState<PipelineDetail | null>(null);
  const [runState, setRunState] = useState<'loading' | 'ready' | 'error'>('loading');
  /** task_definition name → catalog display name; falls back to the wire name. */
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [history, setHistory] = useState<SpringPage<PipelineSummary> | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Latest run → its detail (tasks[]). No polling here: the target pipeline page
  // owns the live view; this tab reloads only on 새로고침.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRunState('loading');
      try {
        const latest = await getLatestPipelineByTarget(targetSourceId);
        if (cancelled) return;
        if (!latest) {
          setRun(null);
          setRunState('ready');
          return;
        }
        const loaded = await getPipeline(latest.pipeline_id);
        if (cancelled) return;
        setRun(loaded);
        setRunState('ready');
        void getTaskDefinitions(loaded.cloud_provider)
          .then((res) => {
            if (cancelled) return;
            setNames(new Map(res.task_definitions.map((entry) => [entry.name, entry.display_name])));
          })
          .catch(() => {
            /* flow strip falls back to the wire task-definition names */
          });
      } catch {
        if (!cancelled) {
          setRun(null);
          setRunState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistoryFailed(false);
      try {
        const loaded = await listPipelinesByTarget(targetSourceId, { page, size: PAGE_SIZE });
        if (!cancelled) setHistory(loaded);
      } catch {
        if (!cancelled) {
          setHistory(null);
          setHistoryFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, page, reloadKey]);

  const tasks = run ? [...run.tasks].sort((a, b) => a.sequence - b.sequence) : [];
  const retry =
    run && run.current_fail_count != null && run.current_max_fail_count != null
      ? `시도 ${run.current_fail_count + 1} / ${run.current_max_fail_count}`
      : null;
  const recipeDesc = recipeLabel(run?.recipe_definition)?.desc ?? null;
  const rows = history?.content ?? [];
  const totalPages = Math.max(1, history?.totalPages ?? 1);
  const { table } = opsStyles;

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="현재 작업">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-bold tracking-[0.02em] text-[var(--pl-primary)]">
              현재 작업
            </div>
            {run && (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <h2 className={opsStyles.cardTitle}>
                    {run.type === 'CUSTOM' ? 'Custom 작업' : recipeDisplayName(run.recipe_definition)}
                  </h2>
                  <span className="text-[13px] text-[var(--pl-text-faint)] [font-family:var(--pl-font-mono)]">
                    #{run.pipeline_id}
                  </span>
                  <OpsPill status={run.status} label={PIPELINE_LABEL[run.status]} />
                </div>
                {recipeDesc && <p className={cn(opsStyles.cardDesc, 'max-w-[760px]')}>{recipeDesc}</p>}
              </>
            )}
          </div>
          <div className="flex flex-none items-center gap-3">
            {run && (
              <Link
                href={passRoutes.pipelines.pipeline(run.pipeline_id)}
                className={opsStyles.detailLink}
              >
                작업 현황 보기
                <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
              </Link>
            )}
            <PlButton variant="secondary" size="sm" onClick={reload}>
              새로고침
            </PlButton>
          </div>
        </div>

        {runState === 'error' ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>작업 정보를 불러오지 못했습니다.</p>
        ) : runState === 'loading' ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')} aria-busy>
            불러오는 중…
          </p>
        ) : !run ? (
          <div className="mt-2 flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-[14px] text-[var(--pl-text-weak)]">실행 중인 작업이 없습니다.</p>
            <Link href={passRoutes.pipelines.target(targetSourceId)} className={opsStyles.detailLink}>
              Target 파이프라인 페이지에서 작업 시작
              <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3.5 text-[13px] font-semibold text-[var(--pl-text-medium)]">
              Task 실행 흐름
            </div>
            <div className="flex items-stretch gap-2.5 overflow-x-auto px-0.5 pb-1.5 pt-3.5">
              {tasks.map((task, index) => (
                <Fragment key={task.task_id}>
                  {index > 0 && (
                    <span className="flex flex-none items-center text-[var(--pl-gray-400)]" aria-hidden>
                      <Icon name="arrow-right" size="md" strokeWidth={2.2} />
                    </span>
                  )}
                  <TaskRunCard
                    task={task}
                    name={names.get(task.task_definition) ?? task.task_definition}
                    retry={task.sequence === run.current_task_sequence ? retry : null}
                    current={task.sequence === run.current_task_sequence}
                  />
                </Fragment>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={pipelineStyles.card.base} aria-label="작업 이력">
        <h2 className={opsStyles.cardTitle}>작업 이력</h2>

        {historyFailed ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>작업 이력을 불러오지 못했습니다.</p>
        ) : rows.length === 0 ? (
          <p className={cn(pipelineStyles.empty.base, 'mt-2')}>실행된 파이프라인이 없습니다.</p>
        ) : (
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={table.base}>
              <thead>
                <tr>
                  <th className={cn(table.headCell, 'w-[72px]')}>#</th>
                  <th className={table.headCell}>작업</th>
                  <th className={table.headCell}>유형</th>
                  <th className={table.headCell}>상태</th>
                  <th className={table.headCell}>진행도</th>
                  <th className={table.headCell}>실행 시각</th>
                  <th className={table.headCell} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const live = isLivePipeline(row.status);
                  return (
                    <tr
                      key={row.pipeline_id}
                      className={cn(table.rowHover, live && 'bg-[var(--pl-primary-bg)]')}
                    >
                      <td className={cn(table.cell, '[font-family:var(--pl-font-mono)]')}>
                        #{row.pipeline_id}
                      </td>
                      <td className={table.cell}>
                        {row.type === 'CUSTOM'
                          ? 'Custom 작업'
                          : recipeDisplayName(row.recipe_definition)}
                      </td>
                      <td className={table.cell}>
                        <span className={cn(opsStyles.statusTag, TYPE_TONE[row.type])}>{row.type}</span>
                      </td>
                      <td className={table.cell}>
                        <OpsPill status={row.status} label={PIPELINE_LABEL[row.status]} />
                      </td>
                      <td className={cn(table.cell, 'tabular-nums [font-family:var(--pl-font-mono)]')}>
                        {row.done_task_count} / {row.total_task_count}
                      </td>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>
                        {fmtDateTime(row.created_at)}
                        <span className="mx-1 text-[var(--pl-text-faint)]" aria-hidden>
                          →
                        </span>
                        {live ? '진행 중' : fmtDateTime(row.last_activity_at)}
                      </td>
                      <td className={cn(table.cell, 'text-right')}>
                        <Link
                          href={passRoutes.pipelines.pipeline(row.pipeline_id)}
                          className={opsStyles.detailLink}
                          aria-label={`작업 #${row.pipeline_id} 상세`}
                        >
                          <Icon name="arrow-up-right" size="sm" strokeWidth={2.2} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <OpsPagination page={page} totalPages={totalPages} onChange={setPage} />
      </section>
    </>
  );
}
