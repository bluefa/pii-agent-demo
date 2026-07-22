'use client';

/**
 * PreviewModal — R24 restyle of the R21 stepped start modal (Figma
 * SzifNRYweRXhiIDI0uyK3R node 9-2, cells C/D/E; custom flow = LIN-22 §B2).
 *
 *   step 'choose'  (§A1): pipeline-type OPTION ROWS (icon tile + title + type
 *     pill + description + chevron, stacked vertically — R24). The page keeps
 *     ONE primary CTA; the type choice (incl. the destructive one) lives
 *     here, behind a deliberate step. CUSTOM disables when the target's
 *     provider is outside the orchestrator enum (e.g. SDU).
 *   step 'preview' (§B1→R24): eyebrow (type tile + pill) + the recipe steps
 *     as R24 task nodes with black seq chips on the 16px grid canvas — ONE
 *     row, horizontal scroll (the clipped node is the affordance) + a
 *     consequence note. [이전] returns to the options.
 *   step 'custom-build' (LIN-22): grid-canvas builder — add from the
 *     provider-scoped catalog (#12), drag nodes to reorder, per-node ✕
 *     delete. [구성 확인] gates on canSubmit (≥1 task).
 *   step 'custom-summary' (LIN-22→R24): the composed order as the same R24
 *     seq-node flow + non-persistence notice → run (#11).
 *
 * Uniqueness handling is shared by both run paths: on 409
 * ORCHESTRATION_PIPELINE_ALREADY_ACTIVE the real API returns a conflict (not
 * the existing run), so we refetch the latest run and navigate there instead
 * (contract gap ③). Custom 400s (UNKNOWN_TASK / TASK_PROVIDER_MISMATCH)
 * surface via the summary-step error line — the builder prevents both in
 * normal use (provider-scoped catalog), so they remain defensive. All user
 * feedback goes through the caller's PlToast (`showToast`).
 */
import { Fragment, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { CustomBuildStep } from '@/app/admin/pipelines/_detail/CustomBuildStep';
import { canSubmit, toCustomRequest } from '@/app/admin/pipelines/_detail/customBuilder';
import {
  FlowArrow,
  R24_CSS,
  R24TaskNode,
  TypePill,
  TypeTile,
} from '@/app/admin/pipelines/_detail/r24Task';
import { passRoutes } from '@/lib/routes';
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
  TaskKind,
} from '@/lib/pipeline/types';

const TITLE_ID = 'pl-preview-title';
const ALREADY_ACTIVE = 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE';

/** Modal title — Figma type ramp `title · 18 / 700` (nodes 9:999 / 9:1093). */
const MODAL_H3 = 'mb-3 text-[18px] font-bold leading-[1.3] tracking-[-0.018em] text-[var(--pl-text-strong)]';

const TYPE_LABELS: Record<PipelineType, string> = {
  INSTALL: '설치',
  DELETE: '삭제',
  CUSTOM: 'Custom',
};

const TYPE_DESCS: Record<PipelineType, string> = {
  INSTALL: '이 대상에 인프라를 설치합니다 — 표준 레시피 7개 Task를 순서대로 실행',
  CUSTOM: 'Task 순서를 직접 구성해 실행합니다 — 실패 구간만 골라 재실행할 때',
  DELETE: '설치된 인프라를 destroy 합니다 — 대상의 리소스가 제거돼요',
};

/** Run-consequence note under the confirmation canvas (design `.m-note`). */
const TYPE_NOTES: Record<PipelineType, ReactNode> = {
  INSTALL: (
    <>
      설치는 대상 계정에 리소스를 생성합니다. 시작 후에는 <b>현재 파이프라인</b> 카드와 파이프라인
      현황에서 진행을 볼 수 있어요.
    </>
  ),
  DELETE: (
    <>
      삭제는 설치된 리소스를 destroy 하며 되돌릴 수 없어요. 시작 후에는 <b>현재 파이프라인</b> 카드에서
      진행을 볼 수 있어요.
    </>
  ),
  CUSTOM: null,
};

/** R24 node flow — ONE row on the grid canvas, horizontal scroll. `numbered`
 *  adds the black order chips (custom summary mirrors the builder); the recipe
 *  preview omits them (Figma step 2 — order reads from the arrows alone). */
function SeqFlow({
  steps,
  numbered = false,
}: {
  steps: ReadonlyArray<{ key: string; kind: TaskKind; name: string; desc?: string | null }>;
  numbered?: boolean;
}): ReactElement {
  return (
    <div className="r24-canvas r24-hscroll mt-3.5">
      <div className="r24-line">
        {steps.map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 && <FlowArrow />}
            <R24TaskNode kind={s.kind} name={s.name} desc={s.desc} seq={numbered ? i + 1 : undefined} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Consequence note line — info glyph + 12px weak text. */
function ModalNote({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="mt-2.5 flex items-start gap-2 rounded-[8px] border border-[var(--pl-gray-100)] bg-[var(--pl-gray-50)] px-3 py-2.5 text-[14px] leading-[1.37] text-[var(--pl-text-weak)] [&_b]:font-semibold [&_b]:text-[var(--pl-text-medium)]">
      <span className="mt-px flex-none text-[var(--pl-text-weak)]">
        <Icon name="warn-tri" size="sm" strokeWidth={2} />
      </span>
      <span>{children}</span>
    </div>
  );
}

/** Modal eyebrow — type tile + mono pill above the title (R24). */
function Eyebrow({ type }: { type: PipelineType }): ReactElement {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <TypeTile type={type} size="xs" />
      <TypePill type={type} />
    </div>
  );
}

type PreviewStep = 'choose' | 'preview' | 'custom-build' | 'custom-summary';

export interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: string;
  /** Orchestrator wire provider; null = custom execution unsupported (e.g. SDU). */
  provider: CloudProvider | null;
  showToast: (message: string) => void;
}

export function PreviewModal({
  open,
  onClose,
  targetSourceId,
  provider,
  showToast,
}: PreviewModalProps): ReactElement | null {
  const router = useRouter();
  const { modal } = pipelineStyles;

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

  // Reset AFTER close so every reopen starts at the type options.
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
        router.push(passRoutes.pipelines.pipeline(detail.pipeline_id));
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
                router.push(passRoutes.pipelines.pipeline(latest.pipeline_id));
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

  const optionRow = (t: PipelineType, disabled = false): ReactElement => (
    <button
      type="button"
      className="flex w-full items-center gap-3.5 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-4 py-[15px] text-left cursor-pointer transition-[border-color,box-shadow] duration-150 hover:border-[var(--pl-primary)] hover:shadow-[0_0_0_3px_var(--pl-primary-ring)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-[var(--pl-border)] disabled:hover:shadow-none"
      disabled={disabled}
      title={disabled ? '이 provider는 Custom 실행을 지원하지 않습니다' : undefined}
      onClick={() => pick(t)}
    >
      <TypeTile type={t} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--pl-text-strong)]">
          {TYPE_LABELS[t]}
          <TypePill type={t} />
        </span>
        <span className="mt-1 block text-[12.5px] leading-[1.55] text-[var(--pl-text-weak)]">
          {TYPE_DESCS[t]}
        </span>
      </span>
      <span className="flex-none text-[var(--pl-text-faint)]">
        <Icon name="chev-r" size="sm" strokeWidth={2.2} />
      </span>
    </button>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={TITLE_ID}
      variant="wide"
      /* Per-step width matches Figma: choose 560 (9-992), preview/summary 760
         (9-1077), builder 960 (canvas + docked catalog). */
      className={
        step === 'choose'
          ? '!w-[560px]'
          : step === 'custom-build'
            ? '!w-[960px] !max-w-[92vw]'
            : '!w-[760px]'
      }
    >
      <style>{R24_CSS}</style>
      {step === 'choose' || !type ? (
        <>
          <h3 id={TITLE_ID} className={MODAL_H3}>
            파이프라인 시작
          </h3>
          {/* Figma 9-992: subtitle is 14px semibold, dark — just the instruction
              (no id·provider prefix on step 1). */}
          <div className="mb-3.5 text-[14px] font-semibold leading-[1.48] tracking-[-0.014em] text-[var(--pl-text-strong)]">
            실행할 파이프라인 유형을 선택하세요
          </div>
          <div className="flex flex-col gap-2.5">
            {optionRow('INSTALL')}
            {optionRow('CUSTOM', !provider)}
            {optionRow('DELETE')}
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.6] text-[var(--pl-text-faint)]">
            유형을 선택하면 실행할 Task 순서를 확인한 뒤 시작합니다.
          </p>
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
          <Eyebrow type="CUSTOM" />
          <h3 id={TITLE_ID} className={MODAL_H3}>
            Custom 파이프라인 구성
          </h3>
          {/* Figma 9:1257 copy. */}
          <div className="text-[14px] leading-[1.48] tracking-[-0.014em] text-[var(--pl-text-weak)]">
            카탈로그에서 Task를 골라 담고 드래그로 순서를 자유롭게 배열하세요.
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
          <Eyebrow type="CUSTOM" />
          <h3 id={TITLE_ID} className={MODAL_H3}>
            Custom 파이프라인 시작
          </h3>
          {/* Consistent with the preview step — 14px, no id·provider prefix. */}
          <div className="text-[14px] leading-[1.48] tracking-[-0.014em] text-[var(--pl-text-weak)]">
            아래 {chosen.length}개 Task를 이 순서로 실행합니다
          </div>
          <SeqFlow
            numbered
            steps={chosen.map((t) => ({
              key: t.name,
              kind: t.kind,
              name: t.display_name,
              desc: t.description,
            }))}
          />
          <ModalNote>이 구성은 저장되지 않으며 이번 실행에만 사용돼요.</ModalNote>

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
          <Eyebrow type={type} />
          {/* Figma 9-1077: subtitle 14px — just the task-count sentence (no
              id·provider·recipe prefix on step 2). */}
          <h3 id={TITLE_ID} className={MODAL_H3}>
            {label} 파이프라인 시작
          </h3>
          <div className="text-[14px] leading-[1.48] tracking-[-0.014em] text-[var(--pl-text-weak)]">
            {preview ? `아래 ${preview.steps.length}개 Task가 순서대로 실행됩니다` : '…'}
          </div>

          {loadError ? (
            <div className={detailStyles.recipe.empty}>미리보기를 불러오지 못했습니다 — {loadError}</div>
          ) : loading || !preview ? (
            <div className={cn(detailStyles.skeleton, 'mt-3.5 h-32')} aria-hidden="true" />
          ) : preview.steps.length ? (
            <>
              <SeqFlow
                steps={preview.steps.map((s) => ({
                  key: String(s.sequence),
                  kind: s.kind,
                  name: s.display_name,
                  desc: s.definition?.description,
                }))}
              />
              {TYPE_NOTES[type] && <ModalNote>{TYPE_NOTES[type]}</ModalNote>}
            </>
          ) : (
            <span className={detailStyles.recipe.empty}>recipe 없음</span>
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
