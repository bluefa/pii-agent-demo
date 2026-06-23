'use client';

import {
  bgColors,
  borderColors,
  cn,
  tagStyles,
  textColors,
} from '@/lib/theme';
import { GCP_STEP_STATUS_LABELS, type GcpStepKey } from '@/lib/constants/gcp';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import { STEP_STATUS_TAG } from '@/app/components/features/process-status/install-task-pipeline/install-task-detail/step-status-tag';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';

interface DetailResourceTableProps {
  rows: InstallResourceRow[];
  stepKey: GcpStepKey;
}

export const DetailResourceTable = ({ rows, stepKey }: DetailResourceTableProps) => {
  // Only GCP rows carry a per-step `source`; rows without one have no step
  // breakdown to display in this detail view.
  const stepRows = rows.filter(
    (row): row is InstallResourceRow & { source: NonNullable<InstallResourceRow['source']> } =>
      row.source !== null,
  );

  if (stepRows.length === 0) {
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
    <div className={cn('overflow-hidden rounded-lg border', bgColors.surface, borderColors.default)}>
      <table className="w-full text-sm">
        <thead className={bgColors.muted}>
          <tr>
            <th className={TABLE_HEADER_CELL}>Resource ID</th>
            <th className={TABLE_HEADER_CELL}>Database Type</th>
            <th className={TABLE_HEADER_CELL}>Region</th>
            <th className={TABLE_HEADER_CELL}>진행 완료 여부</th>
          </tr>
        </thead>
        <tbody>
          {stepRows.map((row) => {
            const stepStatus = row.source[stepKey].status;
            return (
              <tr key={row.resourceId} className="border-t border-[#EBEEF2]">
                <td className={TABLE_MONO_CELL}>
                  {row.resourceId}
                </td>
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>
                      {row.databaseType}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={TABLE_MONO_CELL}>
                  {row.region ?? '—'}
                </td>
                <td className={TABLE_BODY_CELL}>
                  <span className={cn(TABLE_TAG_PILL, STEP_STATUS_TAG[stepStatus])}>
                    {GCP_STEP_STATUS_LABELS[stepStatus]}
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
