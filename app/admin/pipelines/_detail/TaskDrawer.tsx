'use client';

/**
 * TaskDrawer — the right-docked task panel (Figma "pipeline-detail-improved"
 * node 70:35, extended with the R23 job-result surface). This module is the
 * shell: header, tab nav, and Esc layering. The bodies live in sibling modules —
 * execTabs (the two root tabs), AttemptDetail (one attempt, folded open inside
 * the attempt history), and JobViewer (log/state overlay).
 *
 * Two root sub-tabs: Execution info (verdict · job status · attempt history for
 * TERRAFORM_JOB, or verdict · poll history for CONDITION_CHECK) and
 * Definition/contract. A TERRAFORM_JOB attempt-history row folds the attempt
 * open in place (시안 C — it used to replace the header with a ← sub-view); a log
 * button opens the viewer, which lazily fetches the job's log (#5a) and state
 * (#5b). Esc layering: viewer → drawer.
 *
 * The task detail (#5) is fetched lazily by the page when this task is opened;
 * `detail` is null (skeleton via `detailLoaded=false`) until it arrives. The
 * per-job log and state are then fetched on demand from within. The parent
 * remounts per task (`key={task_id}`) so all local view state resets.
 */
import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PipelineStatusBadge } from '@/app/admin/pipelines/_detail/PipelineStatusBadge';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { d, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { ConditionExec, DefinitionTab, TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import { JobViewer } from '@/app/admin/pipelines/_detail/JobViewer';
import { FailureReasonModal } from '@/app/admin/pipelines/_detail/FailureReasonModal';
import type { TaskDetail, TaskSummary } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-drawer-title';
type DrawerTab = 'exec' | 'definition';

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
  /** Restart provenance (§8.4) — href of the ORIGIN task's drawer, or null. */
  originHref?: string | null;
}

export function TaskDrawer({
  task,
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
  originHref,
}: TaskDrawerProps): ReactElement {
  const [tab, setTab] = useState<DrawerTab>('exec');
  const viewerModal = useModal<ViewerTarget>();
  const failModal = useModal<{ detail: string; subtitle: string }>();
  const description = detail ? detail.definition?.description ?? detail.description : null;

  // Esc layering: while a modal is open it owns Esc — the job viewer (ModalShell) closes
  // itself; the failure-reason modal is mouse-only (Esc disabled) so it simply stays put.
  // Either way we bail here so Esc never closes the drawer out from under an open modal.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (viewerModal.isOpen || failModal.isOpen) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerModal.isOpen, failModal.isOpen]);

  return (
    <aside role="complementary" aria-labelledby={TITLE_ID} className={d.root}>
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
            {/* §8.4 — a restart task links straight to the origin task's attempts and
                terraform logs (the source of the failure diagnosis). */}
            {originHref && (
              <Link href={originHref} className={d.originLink} title="원본 작업의 이 Task 상세로 이동">
                이전 실행 이력 보기
                <Icon name="arrow-ur" size="sm" />
              </Link>
            )}
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

      <div className={d.body}>
        {detail ? (
          tab === 'exec' ? (
            detail.kind === 'CONDITION_CHECK' ? (
              <ConditionExec detail={detail} />
            ) : (
              <TerraformExec
                detail={detail}
                onOpenViewer={viewerModal.open}
                onOpenFailure={(n, cause) =>
                  failModal.open({ detail: cause, subtitle: `${displayName} · 시도 #${n}` })
                }
              />
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
