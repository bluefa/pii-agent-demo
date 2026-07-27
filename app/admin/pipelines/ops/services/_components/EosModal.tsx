'use client';

/**
 * EOS 처리 modal (design/pipeline/admin-ops.html openEosModal) — Force 옵션 + a
 * server-message error box. A 409 (진행 중인 파이프라인) keeps the dialog open so
 * the operator can retry with Force.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { requestServiceEos } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-eos-title';

export interface EosModalProps {
  open: boolean;
  onClose: () => void;
  serviceCode: string;
  serviceName: string;
  targetSourceCount: number;
  /** EOS 처리 성공 — 상세를 다시 읽는다. */
  onDone: () => void;
}

export function EosModal({
  open,
  onClose,
  serviceCode,
  serviceName,
  targetSourceCount,
  onDone,
}: EosModalProps): ReactElement | null {
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForce(false);
      setError(null);
    }
  }, [open]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      await requestServiceEos(serviceCode, force);
      onDone();
      onClose();
    } catch (err) {
      // 409 등 서버가 준 detail을 그대로 노출 — 진행 중 작업 목록은 서버만 안다.
      setError(
        err instanceof AppError && err.isUserFacing
          ? err.message
          : 'EOS 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        EOS 처리 — {serviceName} ({serviceCode})
      </h3>
      <p className={pipelineStyles.modal.desc}>
        서비스의 모든 Target Source {targetSourceCount}건이 연동 종료됩니다. 이 작업은 되돌릴 수
        없습니다.
      </p>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--pl-border)] px-3.5 py-3">
        <input
          type="checkbox"
          checked={force}
          onChange={(event) => setForce(event.target.checked)}
          disabled={submitting}
          className="mt-0.5 h-4 w-4 flex-none accent-[var(--pl-primary)]"
        />
        <span className="text-[13px] leading-[1.5] text-[var(--pl-text-medium)]">
          <b className="font-semibold text-[var(--pl-text-strong)]">Force 강제 처리</b> — 진행 중인
          파이프라인·승인 절차를 무시하고 즉시 EOS 처리합니다.
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--pl-err-border)] bg-[var(--pl-err-bg)] px-3.5 py-3 text-[13px] leading-[1.5] text-[var(--pl-err-text)]"
        >
          <span className="mt-0.5 flex-none">
            <Icon name="warn-tri" size="sm" />
          </span>
          <span>{error}</span>
        </div>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
          취소
        </PlButton>
        <PlButton variant="dangerSolid" onClick={() => void submit()} disabled={submitting}>
          {submitting ? '처리 중…' : 'EOS 처리'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
