'use client';

/**
 * Task 상세·로그 modal — the run card's task flow, opened in place.
 *
 * The pipeline 현황 page answers "무슨 일이 있었나" for one task in a right-docked
 * drawer (TaskDrawer). The ops 인프라 작업 tab has no room for a docked panel and
 * no longer sends the operator to that page at all, so the same body is opened
 * here as a modal instead: the verdict + attempt picker + Job 현황 list
 * (execTabs), and a job row opens JobViewer — the log/state reader — over it.
 *
 * This file is only the shell + the one fetch (#5). Every piece of the body is
 * the drawer's own, so the two surfaces cannot drift apart.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { useModal } from '@/app/hooks/useModal';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { d, type ViewerTarget } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { ConditionExec, TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import { JobViewer } from '@/app/admin/pipelines/_detail/JobViewer';
import { DefinitionModal } from '@/app/admin/pipelines/_detail/DefinitionModal';
import { FailureReasonModal } from '@/app/admin/pipelines/_detail/FailureReasonModal';
import { getTaskDetail } from '@/app/lib/api/pipeline';
import type { TaskDetail } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-task-detail-title';

export interface TaskDetailModalProps {
  pipelineId: number;
  taskId: number;
  /** Catalog display name — the same string the flow card printed. */
  displayName: string;
  onClose: () => void;
}

export function TaskDetailModal({
  pipelineId,
  taskId,
  displayName,
  onClose,
}: TaskDetailModalProps): ReactElement {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const viewerModal = useModal<ViewerTarget>();
  const failModal = useModal<{ detail: string; subtitle: string }>();
  const defModal = useModal();

  // The caller mounts this only while it is open, and remounts it per task
  // (`key`), so one fetch per open is the whole lifecycle. `loadKey` is the
  // 재시도 button.
  useEffect(() => {
    let cancelled = false;
    getTaskDetail(pipelineId, taskId)
      .then((res) => !cancelled && setDetail(res))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [pipelineId, taskId, loadKey]);

  // While a child modal is open it owns Esc — otherwise ModalShell would close
  // this dialog out from under the log the operator just opened.
  const closeIfTop = useCallback((): void => {
    if (viewerModal.isOpen || failModal.isOpen || defModal.isOpen) return;
    onClose();
  }, [onClose, viewerModal.isOpen, failModal.isOpen, defModal.isOpen]);

  return (
    <ModalShell open onClose={closeIfTop} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        {displayName}
      </h3>
      <p className={pipelineStyles.modal.desc}>
        <span className="[font-family:var(--pl-font-mono)]">#{pipelineId}</span> 작업에서 이 Task가
        실행된 기록입니다. Job 행을 열면 로그를 볼 수 있습니다.
      </p>

      <div className={cn(pipelineStyles.modal.body, 'flex flex-col gap-6')}>
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
            <div>
              <button type="button" className={d.bodyLink} onClick={() => defModal.open()}>
                정의·계약 보기
              </button>
            </div>
          </>
        ) : failed ? (
          <div className="flex flex-col items-start gap-3">
            <div className={d.empty}>상세를 불러오지 못했습니다</div>
            <PlButton
              variant="secondary"
              size="sm"
              onClick={() => {
                // Cleared here, not in the effect: a setState in an effect body
                // is a lint error (cascading renders), and this is the only path
                // that re-runs the fetch.
                setFailed(false);
                setLoadKey((k) => k + 1);
              }}
            >
              재시도
            </PlButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4" role="status" aria-label="상세 정보를 불러오는 중">
            <div className={cn(detailStyles.skeleton, 'h-4 w-20')} />
            <div className={cn(detailStyles.skeleton, 'h-16 w-full')} />
            <div className={cn(detailStyles.skeleton, 'h-4 w-24 mt-1')} />
            <div className={cn(detailStyles.skeleton, 'h-28 w-full')} />
          </div>
        )}
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
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
    </ModalShell>
  );
}
