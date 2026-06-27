'use client';

import { memo } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { idcStyles, textColors, cn } from '@/lib/theme';
import type { ResourceIntegrationStatus } from '@/lib/types';

export interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;
  region: string;
  resourceName: string;
  selected: boolean;
  /** Exclusion reason text from `excluded_resource_infos[].exclusion_reason`. Only meaningful when `selected === false`. */
  exclusionReason?: string;
  /** Optional metadata line shown beneath the reason text in the tooltip — typically registrant and date. */
  exclusionMeta?: string;
  /** Display db-engine source — prefer endpoint_config.db_type over resource_type (e.g. VM rows). */
  displayDbType?: string;
  /** Per-resource integration history — only rendered in the `applying` variant (step 3). */
  integrationStatus?: ResourceIntegrationStatus | null;
}

/**
 * `waiting` (step 2): target column + exclusion-reason column, separate.
 * `applying` (step 3): merged target/reason column + an integration-history column.
 */
type ApprovalTableVariant = 'waiting' | 'applying';

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
  variant?: ApprovalTableVariant;
  /** Custom empty message shown when `resources` is empty. Defaults to the source-level empty copy. */
  emptyMessage?: string;
  /**
   * When true, render the table as v16 `.approval-table-wrap`: borderless and bottom-rounded
   * only, so it joins directly under the toolbar (top-rounded) as one connected card. Defaults
   * to the standalone framed table (rounded-xl + border + shadow).
   */
  connected?: boolean;
}

// v16 `.approval-table-wrap` (CSS ~2846): border:0; border-radius:0 0 inner inner; overflow:hidden;
// background:#fff — joins flush under the top-rounded toolbar with no gap or top border.
const CONNECTED_FRAME = 'overflow-hidden rounded-b-xl bg-white';

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

const TargetPill = ({ excluded }: { excluded: boolean }) => {
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      <span className={cn(idcStyles.targetPill.dot, variant.dot)} />
      {excluded ? '비대상' : '대상'}
    </span>
  );
};

const ReasonCell = ({ resource }: { resource: WaitingApprovalResource }) =>
  !resource.selected && resource.exclusionReason ? (
    <ReasonChipInline reason={resource.exclusionReason} meta={resource.exclusionMeta} />
  ) : (
    <span className={textColors.quaternary}>{PLACEHOLDER}</span>
  );

// Integration history (step 3) — no API source for integrationStatus in TargetSourceResourceItemDto;
// render — for all rows until the contract provides a value.
const IntegrationHistoryCell = ({ resource }: { resource: WaitingApprovalResource }) => {
  if (!resource.selected) return <span className={textColors.quaternary}>{PLACEHOLDER}</span>;
  if (resource.integrationStatus == null) return <span className={textColors.quaternary}>{PLACEHOLDER}</span>;
  const integrated = resource.integrationStatus === 'INTEGRATED';
  return (
    <span className={cn(idcStyles.tag.base, integrated ? idcStyles.tag.green : idcStyles.tag.orange)}>
      {integrated ? 'Integrated' : 'Pending'}
    </span>
  );
};

export const WaitingApprovalTable = memo(
  ({ resources, variant = 'waiting', emptyMessage, connected = false }: WaitingApprovalTableProps) => {
    if (resources.length === 0) {
      return (
        <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
          {emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </div>
      );
    }

    const applying = variant === 'applying';
    const lastColumnLabel = applying ? '연동 이력' : '제외 사유';
    const targetColumnLabel = applying ? '연동 대상 / 제외 사유' : '연동 대상';
    const monoCell = cn('font-mono text-[12px]', textColors.secondary);

    return (
      <div className={connected ? CONNECTED_FRAME : idcStyles.table.frame}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={idcStyles.table.approvalHeader}>
              <tr className="whitespace-nowrap">
                <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                <th className={idcStyles.table.approvalHeaderCell}>Resource ID</th>
                <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                <th className={idcStyles.table.approvalHeaderCell}>Resource Name</th>
                <th className={idcStyles.table.approvalHeaderCell}>{targetColumnLabel}</th>
                <th className={idcStyles.table.approvalHeaderCell}>{lastColumnLabel}</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {resources.map((resource) => {
                const excluded = !resource.selected;
                return (
                  <tr
                    key={resource.resourceId}
                    className={cn('group', excluded ? idcStyles.table.rowExcluded : idcStyles.table.row)}
                  >
                    <td className={idcStyles.table.approvalCell}>
                      <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>
                        {getDatabaseShortLabel(resource.displayDbType ?? resource.resourceType)}
                      </span>
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, monoCell)}>
                      {resource.region || PLACEHOLDER}
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, 'font-mono text-[12.5px]', textColors.primary)}>
                      {resource.resourceName || PLACEHOLDER}
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      {applying ? (
                        <span className="flex flex-col items-start gap-1.5">
                          <TargetPill excluded={excluded} />
                          {excluded && resource.exclusionReason && (
                            <ReasonChipInline
                              reason={resource.exclusionReason}
                              meta={resource.exclusionMeta}
                            />
                          )}
                        </span>
                      ) : (
                        <TargetPill excluded={excluded} />
                      )}
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                      {applying ? (
                        <IntegrationHistoryCell resource={resource} />
                      ) : (
                        <ReasonCell resource={resource} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

WaitingApprovalTable.displayName = 'WaitingApprovalTable';
