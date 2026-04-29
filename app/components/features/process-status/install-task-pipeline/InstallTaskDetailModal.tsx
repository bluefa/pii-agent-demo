'use client';

// Modal opened when a user clicks a GCP install pipeline card.
// Shows per-resource progress for the selected install step
// (subnet creation / service-side terraform / bdc-side terraform).

import { useEffect, useRef, useState } from 'react';
import {
  buttonStyles,
  cn,
  interactiveColors,
  modalStyles,
  textColors,
} from '@/lib/theme';
import { GCP_STEP_PIPELINE_LABELS, type GcpStepKey } from '@/lib/constants/gcp';
import { CloseIcon } from '@/app/components/ui/icons';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import {
  filterRowsByDetailTab,
  type DetailTab,
} from '@/app/components/features/process-status/install-task-pipeline/install-task-detail/filter-rows';
import { DetailStatusTabs } from '@/app/components/features/process-status/install-task-pipeline/install-task-detail/DetailStatusTabs';
import { DetailResourceTable } from '@/app/components/features/process-status/install-task-pipeline/install-task-detail/DetailResourceTable';

interface InstallTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  stepKey: GcpStepKey | null;
  rows: InstallResourceRow[];
}

export const InstallTaskDetailModal = ({
  open,
  onClose,
  stepKey,
  rows,
}: InstallTaskDetailModalProps) => {
  const [tab, setTab] = useState<DetailTab>('all');
  const [signature, setSignature] = useState<{ open: boolean; stepKey: GcpStepKey | null }>({
    open,
    stepKey,
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  if (signature.open !== open || signature.stepKey !== stepKey) {
    setSignature({ open, stepKey });
    setTab('all');
  }

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !stepKey) return null;

  const visibleRows = filterRowsByDetailTab(rows, stepKey, tab);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className={modalStyles.overlay}
      onClick={handleBackdrop}
    >
      <div
        className={cn(
          modalStyles.container,
          'w-[880px] max-w-[calc(100vw-2rem)] mx-4',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-task-detail-title"
      >
        <div className={modalStyles.header}>
          <div className="min-w-0">
            <h2
              id="install-task-detail-title"
              className={cn('text-lg font-bold', textColors.primary)}
            >
              {GCP_STEP_PIPELINE_LABELS[stepKey]}
            </h2>
            <p className={cn('mt-1 text-sm', textColors.tertiary)}>
              리소스별 설치 진행 현황을 확인할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-colors',
              interactiveColors.closeButton,
            )}
            aria-label="닫기"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className={modalStyles.body}>
          <DetailStatusTabs
            rows={rows}
            stepKey={stepKey}
            value={tab}
            onChange={setTab}
          />
          <DetailResourceTable rows={visibleRows} stepKey={stepKey} />
        </div>

        <div className={modalStyles.footer}>
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonStyles.base, buttonStyles.variants.primary)}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
