'use client';

/**
 * TaskDrawer — the right-docked task panel (Figma "pipeline-detail-improved"
 * node 70:35, extended with the R23 job-result surface). This module is the
 * shell: header, tab nav, Esc layering, and view routing. The bodies live in
 * sibling modules — execTabs (the two root tabs), AttemptDetail (drill-down),
 * and JobViewer (log/state overlay).
 *
 * Two root sub-tabs: Execution info (progress log · attempt count · attempt
 * history for TERRAFORM_JOB, or retry budget · poll history for CONDITION_CHECK)
 * and Definition/contract. A TERRAFORM_JOB attempt-history row drills into the
 * attempt (← replaces the header); a log button opens the viewer, which lazily
 * fetches the job's log (#5a) and state (#5b). Esc layering: viewer → attempt →
 * drawer.
 *
 * The task detail (#5) is fetched lazily by the page when this task is opened;
 * `detail` is null (skeleton via `detailLoaded=false`) until it arrives. The
 * per-job log and state are then fetched on demand from within. The parent
 * remounts per task (`key={task_id}`) so all local view state resets.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { d, j, MiniPill, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { ConditionExec, DefinitionTab, TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import { AttemptDetail } from '@/app/admin/pipelines/_detail/AttemptDetail';
import { JobViewer } from '@/app/admin/pipelines/_detail/JobViewer';
import { FailureReasonModal } from '@/app/admin/pipelines/_detail/FailureReasonModal';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-drawer-title';
type DrawerTab = 'exec' | 'definition';
type DrawerView = { name: 'root' } | { name: 'attempt'; n: number };

const TABS: ReadonlyArray<{ key: DrawerTab; label: string }> = [
  { key: 'exec', label: '실행 정보' },
  { key: 'definition', label: '정의·계약' },
];

export interface TaskDrawerProps {
  task: TaskSummary;
  detail: TaskDetail | null;
  detailLoaded?: boolean;
  displayName: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function TaskDrawer({
  task,
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
}: TaskDrawerProps): ReactElement {
  const [tab, setTab] = useState<DrawerTab>('exec');
  const [view, setView] = useState<DrawerView>({ name: 'root' });
  const viewerModal = useModal<ViewerTarget>();
  const failModal = useModal<{ detail: string; subtitle: string }>();
  const description = detail ? detail.definition?.description ?? detail.description : null;

  // Esc layering: while a modal is open it owns Esc — the job viewer (ModalShell) closes
  // itself; the failure-reason modal is mouse-only (Esc disabled) so it simply stays put.
  // Either way we bail here so Esc never pops the attempt view out from under an open
  // modal. With no modal open, Esc goes attempt → root, then closes the drawer.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (viewerModal.isOpen || failModal.isOpen) return;
      if (view.name === 'attempt') {
        setView({ name: 'root' });
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerModal.isOpen, failModal.isOpen, view]);

  const attempt =
    detail && view.name === 'attempt'
      ? detail.attempts.find((a) => a.attempt_number === view.n) ?? null
      : null;

  return (
    <aside role="complementary" aria-labelledby={TITLE_ID} className={d.root}>
      {view.name === 'attempt' && attempt && detail ? (
        <div className={j.subHeader}>
          <button
            type="button"
            className={j.back}
            onClick={() => setView({ name: 'root' })}
            aria-label="뒤로"
            title="뒤로 (Esc)"
          >
            <Icon name="chev-l" size="lg" />
          </button>
          <div className="min-w-0">
            <div id={TITLE_ID} className={j.subTitle}>
              시도 #{attempt.attempt_number}
              <PipelineStatusBadge status={attempt.status} size="mini" />
              {attempt.error_code && <MiniPill tone="failed">{attempt.error_code}</MiniPill>}
            </div>
            <div className={j.subCrumb}>{displayName}</div>
          </div>
        </div>
      ) : (
        <>
          <div className={d.header}>
            <div className="min-w-0">
              <h3 id={TITLE_ID} className={d.title}>
                {displayName}
                <PipelineStatusBadge status={task.status} className={d.titleBadge} />
              </h3>
              {description && <p className={d.headerDesc}>{description}</p>}
              <div className={d.typeRow}>
                <span className={d.typeLabel}>타입</span>
                <span className={d.tag}>{task.kind}</span>
              </div>
            </div>
            <button type="button" className={d.close} onClick={onClose} aria-label="Task 상세 닫기" title="닫기">
              <Icon name="chev-r" size="lg" />
            </button>
          </div>

          <div className={d.nav}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={cn(d.navTab, active ? d.navActive : d.navIdle)}
                  onClick={() => setTab(t.key)}
                  aria-pressed={active}
                >
                  {t.label}
                  <span className={active ? d.navUnderline : d.navUnderlineHidden} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className={d.body}>
        {detail ? (
          view.name === 'attempt' && attempt ? (
            <AttemptDetail
              attempt={attempt}
              operation={detail.operation}
              onOpenViewer={viewerModal.open}
              onOpenFailure={(cause) =>
                failModal.open({ detail: cause, subtitle: `${displayName} · 시도 #${attempt.attempt_number}` })
              }
            />
          ) : tab === 'exec' ? (
            detail.kind === 'CONDITION_CHECK' ? (
              <ConditionExec detail={detail} />
            ) : (
              <TerraformExec detail={detail} onOpenAttempt={(n) => setView({ name: 'attempt', n })} />
            )
          ) : (
            <DefinitionTab detail={detail} displayName={displayName} />
          )
        ) : !detailLoaded ? (
          <div className="flex flex-col gap-4" role="status" aria-label="상세 정보를 불러오는 중">
            <div className={cn(detailStyles.skeleton, 'h-4 w-20')} />
            <div className={cn(detailStyles.skeleton, 'h-16 w-full')} />
            <div className={cn(detailStyles.skeleton, 'h-4 w-24 mt-1')} />
            <div className={cn(detailStyles.skeleton, 'h-28 w-full')} />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className={d.empty}>상세를 불러오지 못했습니다</div>
            {onRetry && (
              <PlButton variant="secondary" size="sm" onClick={onRetry}>
                재시도
              </PlButton>
            )}
          </div>
        )}
      </div>

      {viewerModal.isOpen && viewerModal.data && detail && (
        <JobViewer
          pipelineId={detail.pipeline_id}
          taskId={detail.task_id}
          target={viewerModal.data}
          jobLabel={displayName}
          onClose={viewerModal.close}
        />
      )}

      {failModal.isOpen && failModal.data && (
        <FailureReasonModal
          detail={failModal.data.detail}
          subtitle={failModal.data.subtitle}
          onClose={failModal.close}
        />
      )}
    </aside>
  );
}
