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
 * hero states the judgment, and 정의·계약 opens as a modal from the body's last
 * row (design-benchmark 시안 B — as a fold it was 40% of the expanded body, for
 * values that are the same on every run). A job row opens the viewer, which
 * lazily fetches the job's log (#5a) and state (#5b). Esc layering: modal → drawer.
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
import { d, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { ConditionExec, TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import { JobViewer } from '@/app/admin/pipelines/_detail/JobViewer';
import { DefinitionModal } from '@/app/admin/pipelines/_detail/DefinitionModal';
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
  const defModal = useModal();

  // Esc layering: while a modal is open it owns Esc — the job viewer and the
  // definition modal (ModalShell) close themselves; the failure-reason modal is
  // mouse-only (Esc disabled) so it simply stays put. Either way we bail here so
  // Esc never closes the drawer out from under an open modal.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (viewerModal.isOpen || failModal.isOpen || defModal.isOpen) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, viewerModal.isOpen, failModal.isOpen, defModal.isOpen]);

  return (
    <aside role="complementary" aria-label={`${displayName} 상세`} className={d.root}>
      {/* Shares the verdict's line (owner 2026-08-16) — absolute, so a long
          status + code wraps under it instead of pushing it off. */}
      <button type="button" className={d.close} onClick={onClose} aria-label="Task 상세 닫기" title="닫기">
        <Icon name="chev-r" size="lg" />
      </button>

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
            {/* Where the panel points, under a rule: the contract rows (a modal
                since 시안 B — they were 40% of the expanded body) and, for a
                restart task, the origin task's attempts and terraform logs (§8.4,
                the source of the failure diagnosis). */}
            <div className={d.bodyLinks}>
              <button type="button" className={d.bodyLink} onClick={() => defModal.open()}>
                정의·계약 보기
                <Icon name="arrow-ur" size="sm" />
              </button>
              {originHref && (
                <Link href={originHref} className={d.bodyLink} title="원본 작업의 이 Task 상세로 이동">
                  이전 실행 이력 보기
                  <Icon name="arrow-ur" size="sm" />
                </Link>
              )}
            </div>
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

      {defModal.isOpen && detail && (
        <DefinitionModal detail={detail} displayName={displayName} onClose={defModal.close} />
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
