'use client';

/**
 * PreviewModal — "{설치|삭제} 실행 미리보기" (design-inventory §Preview). Fetches the
 * recipe preview (#9) and lists its steps; "실행" creates the pipeline (#10) and
 * navigates to it. Uniqueness: on 409 ORCHESTRATION_PIPELINE_ALREADY_ACTIVE the
 * real API returns a conflict (not the existing run), so we refetch the latest run
 * and navigate there instead (contract gap ③).
 *
 * All user feedback goes through the caller's PlToast (`showToast`); the generic
 * app toast is suppressed on the mutation so the design copy is authoritative.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { ModalShell } from '@/app/integration/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/integration/admin/pipelines/_components/PlButton';
import { KindChip } from '@/app/integration/admin/pipelines/_components/KindChip';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';
import { buildPipelineHref, type PipelineNavContext } from '@/lib/pipeline/format';
import {
  createPipeline,
  getLatestPipelineByTarget,
  previewRecipe,
  OrchestratorApiError,
} from '@/app/lib/api/pipeline';
import type { PipelineType, RecipePreview } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-preview-title';
const ALREADY_ACTIVE = 'ORCHESTRATION_PIPELINE_ALREADY_ACTIVE';

export interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: string;
  type: PipelineType;
  providerLabel: string;
  ctx: PipelineNavContext;
  showToast: (message: string) => void;
}

export function PreviewModal({
  open,
  onClose,
  targetSourceId,
  type,
  providerLabel,
  ctx,
  showToast,
}: PreviewModalProps): ReactElement | null {
  const router = useRouter();
  const { modal, text } = pipelineStyles;
  const label = type === 'INSTALL' ? '설치' : '삭제';

  const [preview, setPreview] = useState<RecipePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
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

  const run = useApiAction(() => createPipeline(targetSourceId, { type }), {
    suppressAlert: true,
    onSuccess: (detail) => {
      onClose();
      showToast(`${label} 파이프라인이 실행됐어요`);
      router.push(buildPipelineHref(detail.pipeline_id, ctx));
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
              router.push(buildPipelineHref(latest.pipeline_id, ctx));
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
  });

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={modal.title}>
        {label} 실행 미리보기
      </h3>
      <div className={modal.desc}>
        {targetSourceId} · {providerLabel} · 레시피{' '}
        <span className={text.mono}>{preview?.recipe_definition ?? '…'}</span> — 아래 순서로 파이프라인이
        생성됩니다. <span className={text.muted}>유일성: 진행 중 run이 있으면 기존 run을 반환합니다.</span>
      </div>

      {loadError ? (
        <div className={detailStyles.recipe.empty}>미리보기를 불러오지 못했습니다 — {loadError}</div>
      ) : loading || !preview ? (
        <div className={cn(detailStyles.skeleton, 'h-24')} aria-hidden="true" />
      ) : (
        <div className={detailStyles.recipe.box}>
          {preview.steps.length ? (
            preview.steps.map((step) => (
              <div key={step.sequence} className={detailStyles.recipe.step}>
                <span className={detailStyles.recipe.sq}>{step.sequence}</span>
                {step.display_name}
                <KindChip kind={step.kind} className="ml-auto" />
              </div>
            ))
          ) : (
            <span className={detailStyles.recipe.empty}>recipe 없음</span>
          )}
        </div>
      )}

      {runError && <div className={detailStyles.taskModal.degraded}>{runError}</div>}

      <div className={modal.foot}>
        <PlButton variant="ghost" onClick={onClose}>
          취소
        </PlButton>
        <PlButton
          variant="primary"
          disabled={loading || !preview || !!loadError || run.loading}
          onClick={() => {
            setRunError(null);
            void run.execute();
          }}
        >
          {label} 실행
        </PlButton>
      </div>
    </ModalShell>
  );
}
