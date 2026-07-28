'use client';

/**
 * RestartModal — the "실패 지점부터 재시작" flow (pipeline-restart-design §8.2).
 *
 * Reuses the PreviewModal grammar: R24 seq-node canvas + ModalNote + the 409
 * handler shape. The canvas draws the ORIGIN's WHOLE chain so the picture itself
 * answers "why from here": DONE nodes dim (labelled 완료 — 건너뜀), the resume point
 * carries the origin's failure line (실패 N회 · ERROR_CODE), and the tail renders in
 * the plain re-run tone.
 *
 * Both entry points (LastRunFailedCard on the target page, the exec band on the
 * pipeline page) share this modal. The frontend gate (§8.1) is convenience only, so the server
 * is still the authority: `restart-preview` runs the SAME validation as the
 * execution, and any 409 (`PIPELINE_NOT_RESTARTABLE` / `PIPELINE_NOT_LATEST` /
 * `PIPELINE_ALREADY_ACTIVE`) closes the modal, refetches the latest run, and
 * routes the operator there instead of failing in place.
 *
 * `from_sequence` (moving the resume point earlier) is deliberately NOT wired — the
 * design defers the override to a second pass; this modal always uses the server default.
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { ModalNote } from '@/app/admin/pipelines/_detail/PreviewModal';
import {
  FlowArrow,
  R24_CSS,
  R24TaskNode,
  TypePill,
  TypeTile,
} from '@/app/admin/pipelines/_detail/r24Task';
import { passRoutes } from '@/lib/routes';
import {
  getLatestPipelineByTarget,
  getRestartPreview,
  getTaskDefinitions,
  restartPipeline,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type { CloudProvider, RestartPreview, TaskCatalogEntry } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-restart-title';
const MODAL_H3 = 'mb-3 text-[18px] font-bold leading-[1.3] tracking-[-0.018em] text-[var(--pl-text-strong)]';

/** Server states that mean "this screen is stale" — all three route to the latest run. */
const STALE_CODES = new Set([
  'ORCHESTRATION_PIPELINE_NOT_RESTARTABLE',
  'ORCHESTRATION_PIPELINE_NOT_LATEST',
  'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE',
]);

const isStale = (err: unknown): boolean =>
  err instanceof OrchestratorApiError && err.code !== null && STALE_CODES.has(err.code);

/** Failure line under the resume-point node — why the origin stopped here. */
function originReason(status: string, failCount: number, errorCode: string | null): string {
  if (status === 'FAILED') return `${failCount}회 실패했습니다. 원인은 ${errorCode ?? '기록되지 않았습니다'}.`;
  if (status === 'CANCELLED') return '취소됐습니다. 여기부터 재실행합니다.';
  return '완료되지 않았습니다. 여기부터 재실행합니다.';
}

export interface RestartModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: string;
  /** The origin run — must be the target's latest FAILED/CANCELLED pipeline. */
  pipelineId: number;
  /** Orchestrator wire provider for the task-name catalog; null = wire names. */
  provider: CloudProvider | null;
  showToast: (message: string) => void;
  /** Fired when the server rejected as stale — the caller refetches its latest. */
  onStale?: () => void;
}

export function RestartModal({
  open,
  onClose,
  targetSourceId,
  pipelineId,
  provider,
  showToast,
  onStale,
}: RestartModalProps): ReactElement | null {
  const router = useRouter();
  const { modal } = pipelineStyles;

  const [preview, setPreview] = useState<RestartPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, TaskCatalogEntry>>(new Map());

  // A stale rejection is the same wherever it comes from (preview or execution):
  // close, tell the operator, and hand them the run that IS current.
  const goToLatest = useCallback(async (): Promise<void> => {
    onClose();
    onStale?.();
    showToast('작업 상태가 바뀌었습니다. 최신 작업으로 이동합니다.');
    try {
      const latest = await getLatestPipelineByTarget(targetSourceId);
      if (latest) router.push(passRoutes.pipelines.pipeline(latest.pipeline_id));
    } catch {
      /* the toast already told them; the caller's refetch fixes the screen */
    }
  }, [onClose, onStale, showToast, targetSourceId, router]);

  // Preview (#13) — fetched on mount. Callers mount this modal only while it is
  // open, so every open is a fresh component: a stale screen fails HERE, and no
  // reset effect is needed to clear the previous attempt's state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getRestartPreview(targetSourceId, pipelineId);
        if (!cancelled) setPreview(data);
      } catch (err: unknown) {
        if (cancelled) return;
        if (isStale(err)) {
          void goToLatest();
          return;
        }
        setLoadError(err instanceof Error ? err.message : '재시작 미리보기를 불러오지 못했습니다');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetSourceId, pipelineId, goToLatest]);

  // Task display names (#12) — the preview carries wire definition names only.
  useEffect(() => {
    if (!open || !provider) return;
    let cancelled = false;
    getTaskDefinitions(provider)
      .then((res) => {
        if (!cancelled) setNames(new Map(res.task_definitions.map((e) => [e.name, e])));
      })
      .catch(() => {
        /* nodes fall back to wire names */
      });
    return () => {
      cancelled = true;
    };
  }, [open, provider]);

  const run = useApiAction(() => restartPipeline(targetSourceId, pipelineId), {
    suppressAlert: true,
    onSuccess: (detail) => {
      onClose();
      showToast('멈춘 지점부터 재시작했습니다.');
      router.push(passRoutes.pipelines.pipeline(detail.pipeline_id));
    },
    onError: (err) => {
      if (isStale(err)) {
        void goToLatest();
        return;
      }
      setRunError(err.message);
    },
  });

  if (!open) return null;

  const displayName = (definition: string): string =>
    names.get(definition)?.display_name ?? definition;
  const resumeStep = preview ? preview.resume_from_sequence + 1 : 0;

  // The ORIGIN chain as one node row: skipped (dim) then the re-run suffix, the
  // first of which is the failure point. Sequence chips stay the ORIGIN's
  // numbering — that is what the "N단계부터" CTA refers to.
  const nodes = preview
    ? [
        ...preview.skipped_tasks.map((t) => ({
          key: `skip-${t.sequence}`,
          kind: names.get(t.task_definition)?.kind ?? ('TERRAFORM_JOB' as const),
          name: displayName(t.task_definition),
          desc: '이미 완료되어 건너뜁니다.',
          action: names.get(t.task_definition)?.terraform_action ?? null,
          seq: t.sequence + 1,
          state: 'dim' as const,
        })),
        ...preview.tasks_to_run.map((t, i) => ({
          key: `run-${t.sequence}`,
          kind: t.kind,
          name: displayName(t.task_definition),
          desc:
            i === 0
              ? originReason(t.origin_status, t.origin_fail_count, t.origin_error_code)
              : names.get(t.task_definition)?.description ?? null,
          action: t.terraform_action,
          seq: t.sequence + 1,
          state: i === 0 ? ('fail' as const) : undefined,
        })),
      ]
    : [];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={TITLE_ID}
      variant="wide"
      className="!w-[760px]"
    >
      <style>{R24_CSS}</style>
      {preview && (
        <div className="mb-2.5 flex items-center gap-2">
          <TypeTile type={preview.origin.type} size="xs" />
          <TypePill type={preview.origin.type} />
        </div>
      )}
      <h3 id={TITLE_ID} className={MODAL_H3}>
        재시작
      </h3>
      <div className="text-[14px] leading-[1.48] tracking-[-0.014em] text-[var(--pl-text-weak)]">
        {preview ? (
          <>
            원본 작업 <span className="[font-family:var(--pl-font-mono)]">#{preview.origin.pipeline_id}</span>
            의 {preview.origin.total_task_count}단계 중 {preview.skipped_tasks.length}단계는 건너뛰고,{' '}
            <b className="font-semibold text-[var(--pl-text-strong)]">{resumeStep}단계부터</b>{' '}
            {preview.tasks_to_run.length}개 Task를 다시 실행합니다
          </>
        ) : (
          '…'
        )}
      </div>

      {loadError ? (
        <div className={detailStyles.recipe.empty}>재시작 미리보기를 불러오지 못했습니다. {loadError}</div>
      ) : !preview ? (
        <div className={cn(detailStyles.skeleton, 'mt-3.5 h-32')} aria-hidden="true" />
      ) : (
        <>
          <div className="r24-canvas r24-hscroll mt-3.5">
            <div className="r24-line">
              {nodes.map((n, i) => (
                <Fragment key={n.key}>
                  {i > 0 && <FlowArrow />}
                  <R24TaskNode
                    kind={n.kind}
                    name={n.name}
                    desc={n.desc}
                    action={n.action}
                    seq={n.seq}
                    state={n.state}
                  />
                </Fragment>
              ))}
            </div>
          </div>

          {preview.warnings.map((w) => (
            <ModalNote key={w}>{w}</ModalNote>
          ))}
          <ModalNote>
            재시작은 원본을 되살리지 않고 <b>새 작업</b>으로 실행돼요. 이력에는 원본 링크가 함께 남습니다.
          </ModalNote>
        </>
      )}

      {runError && <div className={detailStyles.taskModal.degraded}>{runError}</div>}

      <div className="flex-1" aria-hidden="true" />
      <div className={modal.foot}>
        <PlButton variant="ghost" onClick={onClose}>
          취소
        </PlButton>
        <PlButton
          variant="primary"
          disabled={!preview || !!loadError || run.loading}
          onClick={() => {
            setRunError(null);
            void run.execute();
          }}
        >
          <Icon name="play" size="sm" />
          {resumeStep}단계부터 재시작
        </PlButton>
      </div>
    </ModalShell>
  );
}
