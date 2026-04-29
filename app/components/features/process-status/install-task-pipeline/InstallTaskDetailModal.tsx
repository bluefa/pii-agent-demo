'use client';

import { useEffect, useRef, useState } from 'react';
import {
  bgColors,
  borderColors,
  buttonStyles,
  cn,
  interactiveColors,
  modalStyles,
  primaryColors,
  shadows,
  tagStyles,
  textColors,
} from '@/lib/theme';
import {
  GCP_STEP_PIPELINE_LABELS,
  type GcpStepKey,
} from '@/lib/constants/gcp';
import { CloseIcon } from '@/app/components/ui/icons';
import type { GcpStepStatusValue } from '@/app/api/_lib/v1-types';
import type { Step4ResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';

export type DetailTab = 'all' | 'done' | 'running';

interface InstallTaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  stepKey: GcpStepKey | null;
  rows: Step4ResourceRow[];
}

const TAB_LABELS: Record<DetailTab, string> = {
  all: '전체',
  done: '완료',
  running: '진행중',
};

const STEP_STATUS_LABEL: Record<GcpStepStatusValue, string> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
  SKIP: '해당없음',
};

const STEP_STATUS_TAG: Record<GcpStepStatusValue, string> = {
  COMPLETED: tagStyles.green,
  IN_PROGRESS: tagStyles.orange,
  FAIL: tagStyles.red,
  SKIP: tagStyles.gray,
};

export const filterRowsByDetailTab = (
  rows: Step4ResourceRow[],
  stepKey: GcpStepKey,
  tab: DetailTab,
): Step4ResourceRow[] =>
  rows.filter((row) => {
    const stepStatus = row.source[stepKey].status;
    if (stepStatus === 'SKIP') return false;
    if (tab === 'all') return true;
    if (tab === 'done') return stepStatus === 'COMPLETED';
    return stepStatus === 'IN_PROGRESS' || stepStatus === 'FAIL';
  });

export const countDetailTabs = (
  rows: Step4ResourceRow[],
  stepKey: GcpStepKey,
): Record<DetailTab, number> => ({
  all: filterRowsByDetailTab(rows, stepKey, 'all').length,
  done: filterRowsByDetailTab(rows, stepKey, 'done').length,
  running: filterRowsByDetailTab(rows, stepKey, 'running').length,
});

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

  const counts = countDetailTabs(rows, stepKey);
  const visibleRows = filterRowsByDetailTab(rows, stepKey, tab);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const title = GCP_STEP_PIPELINE_LABELS[stepKey];

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
              {title}
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
          <div
            role="tablist"
            aria-label="진행 상태 필터"
            className={cn(
              'inline-flex gap-1 p-1 rounded-lg mb-4',
              bgColors.muted,
            )}
          >
            {(['all', 'done', 'running'] as const).map((key) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md',
                    'text-[12.5px] font-semibold',
                    active
                      ? cn(bgColors.surface, textColors.primary, shadows.pill)
                      : cn('bg-transparent', textColors.tertiary),
                  )}
                >
                  <span>{TAB_LABELS[key]}</span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[18px] px-1.5',
                      'rounded-full text-[11px] font-bold',
                      active
                        ? cn(primaryColors.bgLight, primaryColors.text)
                        : cn(bgColors.divider, textColors.tertiary),
                    )}
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          <DetailTable rows={visibleRows} stepKey={stepKey} />
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

interface DetailTableProps {
  rows: Step4ResourceRow[];
  stepKey: GcpStepKey;
}

const DetailTable = ({ rows, stepKey }: DetailTableProps) => {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'px-4 py-3 rounded-lg border text-sm',
          borderColors.default,
          textColors.tertiary,
        )}
      >
        해당 상태의 리소스가 없어요.
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', borderColors.default)}>
      <table className="w-full text-sm">
        <thead className={bgColors.muted}>
          <tr>
            <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>Resource ID</th>
            <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>DB Type</th>
            <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>Region</th>
            <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>진행 완료 여부</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const stepStatus = row.source[stepKey].status;
            return (
              <tr key={row.resourceId} className={cn('border-t', borderColors.light)}>
                <td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
                  {row.resourceId}
                </td>
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.blue)}>
                      {row.databaseType}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
                  {row.region ?? '—'}
                </td>
                <td className={TABLE_BODY_CELL}>
                  <span className={cn(TABLE_TAG_PILL, STEP_STATUS_TAG[stepStatus])}>
                    {STEP_STATUS_LABEL[stepStatus]}
                  </span>
                  {row.source[stepKey].guide ? (
                    <p className={cn('mt-0.5 text-xs', textColors.tertiary)}>
                      {row.source[stepKey].guide}
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
