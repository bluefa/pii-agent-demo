'use client';

/**
 * PreviewModal — R21: the target page's single start-CTA opens this stepped
 * modal (r21-cta-lab A1+B1, owner-picked; custom flow = LIN-22 §B2).
 *
 *   step 'choose'  (§A1): pipeline-type tiles — INSTALL/DELETE/CUSTOM. The
 *     page keeps ONE primary CTA; the type choice (incl. the destructive one)
 *     lives here, behind a deliberate step. CUSTOM disables when the target's
 *     provider is outside the orchestrator enum (e.g. SDU).
 *   step 'preview' (§B1): identity header (TypeTag + target · provider ·
 *     recipe) + the recipe steps as a MINI FLOW in the detail canvas's node
 *     vocabulary (TF/CSP marks, clock for CONDITION_CHECK) — the preview reads
 *     as "the Task 흐름, seen small". [이전] returns to the tiles.
 *   step 'custom-build' (LIN-22): grid-canvas builder (TaskFlow FLOW_CSS
 *     reuse) — add from the provider-scoped catalog (#12), drag nodes to
 *     reorder, per-node ✕ delete. Descriptions are not collected (owner
 *     call). [구성 확인] gates on canSubmit (≥1 task).
 *   step 'custom-summary' (LIN-22): the composed order as the same mini flow
 *     + non-persistence notice → run (#11).
 *
 * Uniqueness handling is shared by both run paths: on 409
 * ORCHESTRATION_PIPELINE_ALREADY_ACTIVE the real API returns a conflict (not
 * the existing run), so we refetch the latest run and navigate there instead
 * (contract gap ③). Custom 400s (UNKNOWN_TASK / TASK_PROVIDER_MISMATCH)
 * surface via the summary-step error line — the builder prevents both in
 * normal use (provider-scoped catalog), so they remain defensive. All user
 * feedback goes through the caller's PlToast (`showToast`).
 */
import { Fragment, useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
import { TerraformLogo, providerLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { CustomBuildStep } from '@/app/admin/pipelines/_detail/CustomBuildStep';
import { canSubmit, toCustomRequest } from '@/app/admin/pipelines/_detail/customBuilder';
import { integrationRoutes } from '@/lib/routes';
import {
  createCustomPipeline,
  createPipeline,
  getLatestPipelineByTarget,
  getTaskDefinitions,
  previewRecipe,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type {
  CloudProvider,
  PipelineType,
  RecipePreview,
  TaskCatalogEntry,
} from '@/lib/pipeline/types';

const TITLE_ID = 'pl-preview-title';
const ALREADY_ACTIVE = 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE';

const TYPE_LABELS: Record<PipelineType, string> = {
  INSTALL: '설치',
  DELETE: '삭제',
  CUSTOM: 'Custom',
};

/** Provider mark tile (modal-scoped classes) — text chip for IDC/SDU. */
function ProviderMarkTile({ provider }: { provider: CloudProvider }): ReactElement {
  const pv = detailStyles.preview;
  const logo = providerLogo(provider);
  if (!logo) return <span className={pv.markTxt}>{provider}</span>;
  return (
    <span className={pv.mark} title={logo.title}>
      {logo.svg}
    </span>
  );
}

type PreviewStep = 'choose' | 'preview' | 'custom-build' | 'custom-summary';

export interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: string;
  providerLabel: string;
  /** Orchestrator wire provider; null = custom execution unsupported (e.g. SDU). */
  provider: CloudProvider | null;
  showToast: (message: string) => void;
}

export function PreviewModal({
  open,
  onClose,
  targetSourceId,
  providerLabel,
  provider,
  showToast,
}: PreviewModalProps): ReactElement | null {
  const router = useRouter();
  const { modal, text } = pipelineStyles;
  const tt = detailStyles.typeTile;
  const pv = detailStyles.preview;
  const bd = detailStyles.builder;

  const [step, setStep] = useState<PreviewStep>('choose');
  const [type, setType] = useState<PipelineType | null>(null);
  const [preview, setPreview] = useState<RecipePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // LIN-22 custom flow — catalog (#12) + the operator-composed task list.
  const [catalog, setCatalog] = useState<TaskCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogKey, setCatalogKey] = useState(0);
  const [chosen, setChosen] = useState<TaskCatalogEntry[]>([]);
  const label = type ? TYPE_LABELS[type] : '';

  // Reset AFTER close so every reopen starts at the type tiles.
  useEffect(() => {
    if (open) return;
    (async () => {
      setStep('choose');
      setType(null);
      setPreview(null);
      setCatalog(null);
      setCatalogError(null);
      setChosen([]);
    })();
  }, [open]);

  // Recipe preview (#9) — fetched once a type is chosen.
  useEffect(() => {
    if (!open || !type) return;
    let cancelled = false;
    (async () => {
      setPreview(null);
      setLoadError(null);
      setRunError(null);
      setLoading(true);
      try {
        const data = await previewRecipe(targetSourceId, type);
        if (!cancelled) setPreview(data);
      } catch (err: unknown) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : '미리보기를 불러오지 못했습니다');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, targetSourceId, type]);

  // Task-definition catalog (#12) — provider-scoped, fetched entering the
  // builder. catalogKey bumps re-run the effect after a failed load (재시도).
  useEffect(() => {
    if (!open || step !== 'custom-build' || !provider || catalog) return;
    let cancelled = false;
    (async () => {
      setCatalogError(null);
      try {
        const res = await getTaskDefinitions(provider);
        if (!cancelled) setCatalog(res.task_definitions);
      } catch (err: unknown) {
        if (!cancelled)
          setCatalogError(err instanceof Error ? err.message : '카탈로그를 불러오지 못했습니다');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, provider, catalog, catalogKey]);

  const run = useApiAction(
    () =>
      type === 'CUSTOM'
        ? createCustomPipeline(targetSourceId, toCustomRequest(chosen))
        : createPipeline(targetSourceId, { type: type ?? 'INSTALL' }),
    {
      suppressAlert: true,
      onSuccess: (detail) => {
        onClose();
        showToast(`${label} 파이프라인이 실행됐어요`);
        router.push(integrationRoutes.pipelines.pipeline(detail.pipeline_id));
      },
      onError: (err) => {
        if (err instanceof OrchestratorApiError && err.code === ALREADY_ACTIVE) {
          // 409 = a run is already active (contract gap ③): refetch the latest run
          // and navigate to it. The refetch itself can fail (or 204 → null when the
          // active run terminated in between) — never hang silently on that path.
          void (async () => {
            try {
              const latest = await getLatestPipelineByTarget(targetSourceId);
              if (latest) {
                onClose();
                showToast('이미 진행 중인 파이프라인으로 이동합니다');
                router.push(integrationRoutes.pipelines.pipeline(latest.pipeline_id));
                return;
              }
            } catch {
              /* fall through to the failure toast */
            }
            onClose();
            showToast('진행 중인 파이프라인 확인에 실패했습니다 — 새로고침 후 다시 시도하세요');
          })();
          return;
        }
        setRunError(err.message);
      },
    },
  );

  if (!open) return null;

  const pick = (next: PipelineType): void => {
    setType(next);
    setStep(next === 'CUSTOM' ? 'custom-build' : 'preview');
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID} variant="wide">
      {step === 'choose' || !type ? (
        <>
          <h3 id={TITLE_ID} className={modal.title}>
            파이프라인 시작
          </h3>
          <div className={modal.desc}>
            <span className={pv.identNum}>{targetSourceId}</span> · {providerLabel} — 실행할 파이프라인
            유형을 선택하세요
          </div>
          <div className={tt.row}>
            <button type="button" className={tt.tile} onClick={() => pick('INSTALL')}>
              <span className={cn(tt.ico, tt.icoTone.INSTALL)}>
                <Icon name="install" />
              </span>
              <span className={tt.title}>설치</span>
              <span className={tt.desc}>이 대상에 인프라를 설치합니다</span>
            </button>
            <button
              type="button"
              className={tt.tile}
              disabled={!provider}
              title={provider ? undefined : '이 provider는 Custom 실행을 지원하지 않습니다'}
              onClick={() => pick('CUSTOM')}
            >
              <span className={cn(tt.ico, tt.icoTone.CUSTOM)}>
                <Icon name="sliders" />
              </span>
              <span className={tt.title}>Custom</span>
              <span className={tt.desc}>Task 순서를 직접 구성해 실행합니다</span>
            </button>
            <button type="button" className={tt.tile} onClick={() => pick('DELETE')}>
              <span className={cn(tt.ico, tt.icoTone.DELETE)}>
                <Icon name="trash" />
              </span>
              <span className={tt.title}>삭제</span>
              <span className={tt.desc}>설치된 인프라를 destroy 합니다</span>
            </button>
          </div>
          {/* R22.5 — dialogWide is flex-col with a min height; the spacer pins
              the foot to the bottom of the taller dialog. */}
          <div className="flex-1" aria-hidden="true" />
          <div className={modal.foot}>
            <PlButton variant="ghost" onClick={onClose}>
              취소
            </PlButton>
          </div>
        </>
      ) : step === 'custom-build' ? (
        <>
          <PipelineTypeTag type="CUSTOM" />
          <h3 id={TITLE_ID} className={cn(modal.title, 'mt-1.5')}>
            Custom 파이프라인 구성
          </h3>
          <div className={pv.ident}>
            <span className={pv.identNum}>{targetSourceId}</span> · {providerLabel} — Task를 추가하고
            드래그로 실행 순서를 구성하세요
          </div>
          <div className="mt-3.5">
            <CustomBuildStep
              catalog={catalog}
              catalogError={catalogError}
              onRetry={() => {
                setCatalogError(null);
                setCatalogKey((k) => k + 1);
              }}
              chosen={chosen}
              onChange={setChosen}
              provider={provider}
            />
          </div>
          <div className="flex-1" aria-hidden="true" />
          <div className={modal.foot}>
            <PlButton
              variant="ghost"
              onClick={() => {
                setStep('choose');
                setType(null);
              }}
            >
              이전
            </PlButton>
            <PlButton
              variant="primary"
              disabled={!canSubmit(chosen)}
              onClick={() => setStep('custom-summary')}
            >
              구성 확인
            </PlButton>
          </div>
        </>
      ) : step === 'custom-summary' ? (
        <>
          <PipelineTypeTag type="CUSTOM" />
          <h3 id={TITLE_ID} className={cn(modal.title, 'mt-1.5')}>
            Custom 파이프라인 시작
          </h3>
          <div className={pv.ident}>
            <span className={pv.identNum}>{targetSourceId}</span> · {providerLabel} · Task{' '}
            {chosen.length}개를 아래 순서로 실행합니다
          </div>
          <div className={pv.flow}>
            {chosen.map((t, i) => (
              <Fragment key={t.name}>
                {i > 0 && <span className={pv.conn} aria-hidden="true" />}
                <span className={pv.node}>
                  <span className={pv.nodeIcons}>
                    {t.kind === 'CONDITION_CHECK' ? (
                      <span className={pv.markCond} title="조건 확인 — 폴링">
                        <Icon name="clock" size="sm" />
                      </span>
                    ) : (
                      <>
                        <span className={pv.mark} title="Terraform">
                          <TerraformLogo />
                        </span>
                        {provider ? <ProviderMarkTile provider={provider} /> : null}
                      </>
                    )}
                  </span>
                  <span className={pv.nodeName}>{t.display_name}</span>
                </span>
              </Fragment>
            ))}
          </div>
          <div>
            <span className={bd.notice}>이 구성은 저장되지 않습니다 — 이번 실행에만 사용돼요</span>
          </div>

          {runError && <div className={detailStyles.taskModal.degraded}>{runError}</div>}

          <div className="flex-1" aria-hidden="true" />
          <div className={modal.foot}>
            <PlButton variant="ghost" onClick={() => setStep('custom-build')}>
              이전
            </PlButton>
            <PlButton
              variant="primary"
              disabled={!canSubmit(chosen) || run.loading}
              onClick={() => {
                setRunError(null);
                void run.execute();
              }}
            >
              <Icon name="play" size="sm" />
              Custom 시작
            </PlButton>
          </div>
        </>
      ) : (
        <>
          <PipelineTypeTag type={type} />
          <h3 id={TITLE_ID} className={cn(modal.title, 'mt-1.5')}>
            {label} 파이프라인 시작
          </h3>
          <div className={pv.ident}>
            <span className={pv.identNum}>{targetSourceId}</span> · {providerLabel} ·{' '}
            <span className={text.mono}>{preview?.recipe_definition ?? '…'}</span>
            {preview?.display_name ? <span className={text.muted}> {preview.display_name}</span> : null}
          </div>

          {loadError ? (
            <div className={detailStyles.recipe.empty}>미리보기를 불러오지 못했습니다 — {loadError}</div>
          ) : loading || !preview ? (
            <div className={cn(detailStyles.skeleton, 'mt-3.5 h-24')} aria-hidden="true" />
          ) : (
            <div className={pv.flow}>
              {preview.steps.length ? (
                preview.steps.map((s, i) => (
                  <Fragment key={s.sequence}>
                    {i > 0 && <span className={pv.conn} aria-hidden="true" />}
                    <span className={pv.node}>
                      <span className={pv.nodeIcons}>
                        {s.kind === 'CONDITION_CHECK' ? (
                          <span className={pv.markCond} title="조건 확인 — 폴링">
                            <Icon name="clock" size="sm" />
                          </span>
                        ) : (
                          <>
                            <span className={pv.mark} title="Terraform">
                              <TerraformLogo />
                            </span>
                            <ProviderMarkTile provider={preview.provider} />
                          </>
                        )}
                      </span>
                      <span className={pv.nodeName}>{s.display_name}</span>
                    </span>
                  </Fragment>
                ))
              ) : (
                <span className={detailStyles.recipe.empty}>recipe 없음</span>
              )}
            </div>
          )}

          {runError && <div className={detailStyles.taskModal.degraded}>{runError}</div>}

          <div className="flex-1" aria-hidden="true" />
          <div className={modal.foot}>
            <PlButton
              variant="ghost"
              onClick={() => {
                setStep('choose');
                setType(null);
              }}
            >
              이전
            </PlButton>
            <PlButton
              variant="primary"
              disabled={loading || !preview || !!loadError || run.loading}
              onClick={() => {
                setRunError(null);
                void run.execute();
              }}
            >
              <Icon name="play" size="sm" />
              {label} 시작
            </PlButton>
          </div>
        </>
      )}
    </ModalShell>
  );
}
