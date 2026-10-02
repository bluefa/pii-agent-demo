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
 * Both entry points (the 최근 작업 run card on the target page, the exec band on the
 * pipeline page) share this modal. The frontend gate (§8.1) is convenience only, so the server
 * is still the authority: `restart-preview` runs the SAME validation as the
 * execution, and any 409 (`PIPELINE_NOT_RESTARTABLE` / `PIPELINE_NOT_LATEST` /
 * `PIPELINE_ALREADY_ACTIVE`) closes the modal, refetches the latest run, and
 * routes the operator there instead of failing in place.
 *
 * Choosing `from_sequence` (moving the resume point earlier) is deliberately NOT
 * wired — the design defers the override to a second pass. The execution still
 * SENDS `from_sequence`, echoing the resume point the preview just computed:
 * upstream 500s on a bodyless restart, so "omit it for the server default" is not
 * a usable path. Same resume point either way — this one just doesn't blow up.
 */
import { Fragment, useCallback, useEffect, useState, type ReactElement } from 'react';
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
import { taskInfraSide } from '@/lib/pipeline/format';
import {
  getRestartPreview,
  getTaskDefinitions,
  restartPipeline,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type {
  CloudProvider,
  PipelineDetail,
  RestartPreview,
  TaskCatalogEntry,
} from '@/lib/pipeline/types';

const TITLE_ID = 'pl-restart-title';
const MODAL_H3 = 'mb-3 text-[18px] font-bold leading-[1.3] tracking-[-0.018em] text-[var(--pl-text-strong)]';

/** Server states that mean "this screen is stale" — all three refetch the run set. */
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
  /** Names the caller resolved for definitions the catalog omits (useMissingTaskNames). */
  taskNames?: ReadonlyMap<string, string>;
  showToast: (message: string) => void;
  /** Fired when the server rejected as stale — the caller refetches its latest. */
  onStale?: () => void;
  /** Fired once the restart exists, with the run the server just created. The ops
   *  tab refetches in place (owner: a restart must not throw the operator off the
   *  tab it was started from); the pipeline page follows the new run instead —
   *  a page ABOUT one run has nothing left to say once its successor exists. */
  onStarted?: (created: PipelineDetail) => void;
}

export function RestartModal({
  open,
  onClose,
  targetSourceId,
  pipelineId,
  provider,
  taskNames,
  showToast,
  onStale,
  onStarted,
}: RestartModalProps): ReactElement | null {
  const { modal } = pipelineStyles;

  const [preview, setPreview] = useState<RestartPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, TaskCatalogEntry>>(new Map());

  // A stale rejection is the same wherever it comes from (preview or execution):
  // close, tell the operator, and let the caller refetch — the card under this
  // modal is the run that IS current, so there is nowhere to send them.
  const goToLatest = useCallback((): void => {
    onClose();
    onStale?.();
    showToast('작업 상태가 바뀌었습니다. 최신 작업으로 갱신합니다.');
  }, [onClose, onStale, showToast]);

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
          goToLatest();
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

  // The CTA is disabled until the preview lands, so `preview` is non-null here in
  // practice; the throw is the type guard, and it surfaces as a normal run error.
  const run = useApiAction(() => {
    if (!preview) throw new Error('재시작 미리보기를 불러오지 못했습니다');
    return restartPipeline(targetSourceId, pipelineId, {
      from_sequence: preview.resume_from_sequence,
    });
  }, {
    suppressAlert: true,
    onSuccess: (created) => {
      onClose();
      showToast('멈춘 지점부터 재시작했습니다.');
      onStarted?.(created);
    },
    onError: (err) => {
      if (isStale(err)) {
        goToLatest();
        return;
      }
      setRunError(err.message);
    },
  });

  if (!open) return null;

  const displayName = (definition: string): string =>
    names.get(definition)?.display_name ?? taskNames?.get(definition) ?? definition;
  const resumeStep = preview ? preview.resume_from_sequence + 1 : 0;

  // The ORIGIN chain as one node row: skipped (dim) then the re-run suffix, the
  // first of which is the failure point. Sequence chips stay the ORIGIN's
  // numbering — that is what the "N단계부터" CTA refers to.
  const nodes = preview
    ? [
        ...preview.skipped_tasks.map((t) => ({
          key: `skip-${t.sequence}`,
          kind: names.get(t.task_definition)?.kind ?? ('TERRAFORM_JOB' as const),
          definition: t.task_definition,
          name: displayName(t.task_definition),
          desc: '이미 완료되어 건너뜁니다.',
          action: names.get(t.task_definition)?.terraform_action ?? null,
          side: taskInfraSide(t.task_definition, names.get(t.task_definition)?.kind),
          seq: t.sequence + 1,
          state: 'dim' as const,
        })),
        ...preview.tasks_to_run.map((t, i) => ({
          key: `run-${t.sequence}`,
          kind: t.kind,
          definition: t.task_definition,
          name: displayName(t.task_definition),
          desc:
            i === 0
              ? originReason(t.origin_status, t.origin_fail_count, t.origin_error_code)
              : names.get(t.task_definition)?.description ?? null,
          action: t.terraform_action,
          side: taskInfraSide(t.task_definition, t.kind),
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
                    definition={n.definition}
                    name={n.name}
                    desc={n.desc}
                    action={n.action}
                    side={n.side}
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

      {/* 실패는 눌린 버튼 바로 위에 남는다 — 모달이 닫히지 않으므로 여기가 조작한
          사람이 보고 있는 자리다. 토스트로 띄우면 재시도하려고 버튼을 다시 볼 때는
          이미 사라져 있다. 서버 메시지는 그대로 싣되, 무엇이 실패했는지는 앞에서
          말한다 — 원문만으로는 재시작이 실패했다는 사실이 안 읽힌다.
          여백(flex-1) 아래에 둔다: 위에 두면 미리보기가 짧을 때 여백이 벌어지며
          오류가 버튼에서 멀찍이 떠오른다. */}
      <div className="flex-1" aria-hidden="true" />
      {runError && (
        <div className={detailStyles.taskModal.actionError} role="alert">
          재시작하지 못했습니다. {runError}
        </div>
      )}
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
