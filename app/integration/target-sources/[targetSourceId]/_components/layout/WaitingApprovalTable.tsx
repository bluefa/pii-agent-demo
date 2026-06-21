'use client';

import { memo } from 'react';
import { Badge } from '@/app/components/ui/Badge';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { idcStyles, tableStyles, textColors, cn } from '@/lib/theme';

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
}

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
  /** Custom empty message shown when `resources` is empty. Defaults to the source-level empty copy. */
  emptyMessage?: string;
}

const DEFAULT_EMPTY_MESSAGE = '표시할 리소스가 없습니다.';

const PLACEHOLDER = '—';

const COLUMNS: readonly { label: string; widthClass?: string }[] = [
  { label: 'Database Type' },
  { label: 'Resource ID' },
  { label: 'Region' },
  { label: 'Resource Name' },
  { label: '연동 대상 여부' },
  { label: '제외 사유' },
];

const MONO_CELL = cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary);

// v15 .approval-table tr.row-excluded — gray td bg + #6B7280 mono/res-id text.
const EXCLUDED_CELL = 'bg-[#F2F4F6]';
const EXCLUDED_MONO = 'text-[#6B7280]';

const TargetPill = ({ excluded }: { excluded: boolean }) => {
  const variant = excluded ? idcStyles.targetPill.no : idcStyles.targetPill.yes;
  return (
    <span className={cn(idcStyles.targetPill.base, variant.box)}>
      <span className={cn(idcStyles.targetPill.dot, variant.dot)} />
      {excluded ? '비대상' : '대상'}
    </span>
  );
};

export const WaitingApprovalTable = memo(({ resources, emptyMessage }: WaitingApprovalTableProps) => {
  if (resources.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? DEFAULT_EMPTY_MESSAGE}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className={tableStyles.header}>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.label} className={cn(tableStyles.headerCell, column.widthClass)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {resources.map((resource) => {
            const excluded = !resource.selected;
            return (
            <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
              <td className={cn(tableStyles.cell, excluded && EXCLUDED_CELL)}>
                <Badge variant="info" size="sm">{resource.resourceType}</Badge>
              </td>
              <td className={cn(MONO_CELL, excluded && cn(EXCLUDED_CELL, EXCLUDED_MONO))}>
                <span className="inline-flex items-center gap-1">
                  <span>{resource.resourceId}</span>
                  <CopyButton
                    value={resource.resourceId}
                    label={`${resource.resourceId} 복사`}
                    className="opacity-0 group-hover:opacity-100"
                  />
                </span>
              </td>
              <td className={cn(MONO_CELL, excluded && cn(EXCLUDED_CELL, EXCLUDED_MONO))}>
                {resource.region ? (
                  <span className="inline-flex items-center gap-1">
                    <span>{resource.region}</span>
                    <CopyButton
                      value={resource.region}
                      label={`${resource.region} 복사`}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </span>
                ) : PLACEHOLDER}
              </td>
              <td className={cn(MONO_CELL, excluded && cn(EXCLUDED_CELL, EXCLUDED_MONO))}>
                {resource.resourceName ? (
                  <span className="inline-flex items-center gap-1">
                    <span>{resource.resourceName}</span>
                    <CopyButton
                      value={resource.resourceName}
                      label={`${resource.resourceName} 복사`}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </span>
                ) : PLACEHOLDER}
              </td>
              <td className={cn(tableStyles.cell, excluded && EXCLUDED_CELL)}>
                <TargetPill excluded={excluded} />
              </td>
              <td className={cn(tableStyles.cell, 'text-sm', excluded && EXCLUDED_CELL)}>
                {!resource.selected && resource.exclusionReason ? (
                  <ReasonChipInline
                    reason={resource.exclusionReason}
                    meta={resource.exclusionMeta}
                  />
                ) : (
                  <span className={textColors.quaternary}>{PLACEHOLDER}</span>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

WaitingApprovalTable.displayName = 'WaitingApprovalTable';
