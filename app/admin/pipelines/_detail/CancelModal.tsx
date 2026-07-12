'use client';

/**
 * CancelModal — "파이프라인 취소" (design-inventory §Cancel, adjusted for contract
 * gap ⑤). The real cancel is two-phase: an idle/PENDING run cancels immediately
 * (→ CANCELLED); a live-leased run only records cancel_requested and the worker
 * applies it at the next safe point (response may be RUNNING + cancel_requested).
 * So the copy is the two-phase wording, the response is rendered verbatim by the
 * caller (`onCancelled`), and the success toast branches on the response status.
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { detailStyles } from '@/app/admin/pipelines/_detail/detailStyles';
import { cancelPipeline } from '@/app/lib/api/pipeline';
import type { PipelineDetail } from '@/lib/pipeline/types';

const TITLE_ID = 'pl-cancel-title';

export interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  pipelineId: number | string;
  /** Receives the post-cancel PipelineDetail so the page can render it verbatim. */
  onCancelled: (detail: PipelineDetail) => void;
  showToast: (message: string) => void;
}

export function CancelModal({
  open,
  onClose,
  pipelineId,
  onCancelled,
  showToast,
}: CancelModalProps): ReactElement | null {
  const [error, setError] = useState<string | null>(null);

  const cancel = useApiAction(() => cancelPipeline(pipelineId), {
    suppressAlert: true,
    onSuccess: (detail) => {
      onClose();
      showToast(detail.status === 'CANCELLED' ? `#${pipelineId} 취소됨` : `#${pipelineId} 취소 요청됨`);
      onCancelled(detail);
    },
    onError: (err) => setError(err.message),
  });

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID} className="!w-[560px] !p-7">
      <h3 id={TITLE_ID} className="text-[24px] font-bold leading-[1.3] text-[var(--pl-text-strong)] mb-3">
        파이프라인 취소
      </h3>
      <div className="text-[18px] leading-[1.6] text-[var(--pl-text-medium)]">
        #{pipelineId} 파이프라인을 취소할까요? 대기 중이면 즉시 취소되고, 실행 중이면 다음 실행 사이클에
        반영됩니다.
      </div>

      {error && <div className={cn(detailStyles.taskModal.degraded, 'mt-4')}>{error}</div>}

      <div className="flex justify-end gap-2.5 mt-7">
        <PlButton variant="ghost" onClick={onClose}>
          닫기
        </PlButton>
        <PlButton
          variant="dangerSolid"
          disabled={cancel.loading}
          onClick={() => {
            setError(null);
            void cancel.execute();
          }}
        >
          취소 실행
        </PlButton>
      </div>
    </ModalShell>
  );
}
