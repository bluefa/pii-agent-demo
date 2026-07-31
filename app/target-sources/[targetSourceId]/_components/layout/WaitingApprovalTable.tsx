'use client';

import { memo } from 'react';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { idcStyles, textColors, cn } from '@/lib/theme';

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
}

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
  /** Custom empty message shown when `resources` is empty. Defaults to the source-level empty copy. */
  emptyMessage?: string;
  /**
   * When true, render the table as v16 `.approval-table-wrap`: borderless and bottom-rounded
   * only, so it joins directly under the toolbar (top-rounded) as one connected card. Defaults
   * to the standalone framed table (rounded-xl + border + shadow).
   */
  connected?: boolean;
}

// v16 `.approval-table-wrap` (CSS ~2846): border:0; overflow:hidden; background:#fff — joins flush
// under the top-rounded toolbar. The bottom radius belongs to the pagination footer stacked below.
const CONNECTED_FRAME = 'overflow-hidden bg-white';

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

// No status dot: the label already says 대상 / 제외, so the dot repeats it in a weaker channel.
const TargetPill = ({ excluded }: { excluded: boolean }) => {
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      {excluded ? '제외' : '대상'}
    </span>
  );
};

// The chip's own 40-char default overruns this six-column table and forces horizontal
// scroll (Azure step 3 reasons run past it). Clamp here — the full text is in the hover tip.
const SUMMARY_LIMIT = 22;

const clampReason = (reason: string): string =>
  reason.length <= SUMMARY_LIMIT ? reason : reason.slice(0, SUMMARY_LIMIT).trimEnd() + '…';

// Blank when there is no reason — target rows can never have one, so an em-dash is noise.
const ReasonCell = ({ resource }: { resource: WaitingApprovalResource }) =>
  !resource.selected && resource.exclusionReason ? (
    <ReasonChipInline
      reason={resource.exclusionReason}
      summary={clampReason(resource.exclusionReason)}
      meta={resource.exclusionMeta}
    />
  ) : null;

export const WaitingApprovalTable = memo(
  ({ resources, emptyMessage, connected = false }: WaitingApprovalTableProps) => {
    if (resources.length === 0) {
      return (
        <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
          {emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
        </div>
      );
    }

    const monoCell = cn('font-mono text-[12px]', textColors.secondary);

    return (
      <div className={connected ? CONNECTED_FRAME : idcStyles.table.frame}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={idcStyles.table.approvalHeader}>
              {/* Identity (name → id) → attributes (type · region) → decision (verdict → reason).
                  The scan anchor is the human-readable name, not a 3-value category column. */}
              <tr className="whitespace-nowrap">
                <th className={idcStyles.table.approvalHeaderCell}>Resource Name</th>
                <th className={idcStyles.table.approvalHeaderCell}>Resource ID</th>
                <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
                <th className={idcStyles.table.approvalHeaderCell}>Region</th>
                {/* The header asks the question, the cell answers it. */}
                <th className={idcStyles.table.approvalHeaderCell}>요청 대상 여부</th>
                <th className={idcStyles.table.approvalHeaderCell}>제외 사유</th>
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
                    <td className={cn(idcStyles.table.approvalCell, 'font-mono text-[14px]', textColors.primary)}>
                      {resource.resourceName || PLACEHOLDER}
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                    </td>
                    {/* DB Type is a repeating attribute, not a status — one badge per row (the
                        verdict) is enough; a second pill would compete with it. */}
                    <td className={cn(idcStyles.table.approvalCell, 'text-[12px]', textColors.secondary)}>
                      {getDatabaseShortLabel(resource.displayDbType ?? resource.resourceType)}
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, monoCell)}>
                      {resource.region || PLACEHOLDER}
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <TargetPill excluded={excluded} />
                    </td>
                    <td className={cn(idcStyles.table.approvalCell, 'text-sm')}>
                      <ReasonCell resource={resource} />
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
