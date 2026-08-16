'use client';

/**
 * TaskDrawer — the right-docked task panel (Figma "pipeline-detail-improved"
 * node 70:35, extended with the R23 job-result surface). This module is the
 * shell: the close strip, the body, and Esc layering. The bodies live in sibling
 * modules — execTabs (verdict + attempt picker, or the poll history for
 * CONDITION_CHECK), AttemptDetail (the selected attempt), JobViewer (log/state
 * overlay).
 *
 * One body, no tabs (owner 2026-08-16). The title / description / 타입 header and
 * the 실행 정보 · 정의·계약 tab bar cost 199px that the Job list needed: the flow
 * card beside the panel already carries the task's name and status, the verdict
 * hero states the judgment, and 정의·계약 is now a fold at the body's last row.
 * A job row opens the viewer, which lazily fetches the job's log (#5a) and state
 * (#5b). Esc layering: viewer → drawer.
 *
 * The task detail (#5) is fetched lazily by the page when this task is opened;
 * `detail` is null (skeleton via `detailLoaded=false`) until it arrives. The
 * per-job log and state are then fetched on demand from within. The parent
 * remounts per task (`key={task_id}`) so all local view state resets.
 */
import { useEffect, type ReactElement } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { d, j, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { ConditionExec, DefinitionTab, TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import { JobViewer } from '@/app/admin/pipelines/_detail/JobViewer';
import { FailureReasonModal } from '@/app/admin/pipelines/_detail/FailureReasonModal';
import type { TaskDetail } from '@/lib/pipeline/types';

export interface TaskDrawerProps {
  detail: TaskDetail | null;
  detailLoaded?: boolean;
  displayName: string;
  onClose: () => void;
  onRetry?: () => void;
  /** Restart provenance (§8.4) — href of the ORIGIN task's drawer, or null. */
  originHref?: string | null;
}

export function TaskDrawer({
  detail,
  detailLoaded = true,
  displayName,
  onClose,
  onRetry,
  originHref,
}: TaskDrawerProps): ReactElement {
  const viewerModal = useModal<ViewerTarget>();
  const failModal = useModal<{ detail: string; subtitle: string }>();

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
    <aside role="complementary" aria-label={`${displayName} 상세`} className={d.root}>
      <div className={d.header}>
        {/* §8.4 — a restart task links straight to the origin task's attempts and
            terraform logs (the source of the failure diagnosis). */}
        {originHref && (
          <Link href={originHref} className={d.originLink} title="원본 작업의 이 Task 상세로 이동">
            이전 실행 이력 보기
            <Icon name="arrow-ur" size="sm" />
          </Link>
        )}
        <button type="button" className={d.close} onClick={onClose} aria-label="Task 상세 닫기" title="닫기">
          <Icon name="chev-r" size="lg" />
        </button>
      </div>

      <div className={d.body}>
        {detail ? (
          <>
            {detail.kind === 'CONDITION_CHECK' ? (
              <ConditionExec detail={detail} />
            ) : (
              <TerraformExec
                detail={detail}
                onOpenViewer={viewerModal.open}
                onOpenFailure={(n, cause) =>
                  failModal.open({ detail: cause, subtitle: `${displayName} · 시도 #${n}` })
                }
              />
            )}
            {/* The second sub-tab, folded shut at the bottom: a contract row set
                nobody opens the panel for should not cost a tab bar. */}
            <details className={d.defFold}>
              <summary className={d.foldSummary}>
                <span className={j.respTri} aria-hidden="true">▼</span>정의·계약
              </summary>
              <div className={d.defBody}>
                <DefinitionTab detail={detail} displayName={displayName} />
              </div>
            </details>
          </>
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
