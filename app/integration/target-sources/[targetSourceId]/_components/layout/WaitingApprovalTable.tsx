'use client';

import { Badge } from '@/app/components/ui/Badge';
import { tableStyles, textColors, cn } from '@/lib/theme';
import type { ResourceScanStatus } from '@/lib/types';

export interface WaitingApprovalResource {
  resourceId: string;
  resourceType: string;
  region: string;
  databaseName: string;
  selected: boolean;
  scanStatus?: ResourceScanStatus | null;
}

interface WaitingApprovalTableProps {
  resources: readonly WaitingApprovalResource[];
}

const PLACEHOLDER = '—';

const formatScanStatus = (status: ResourceScanStatus | null | undefined): string => {
  if (status === 'NEW_SCAN') return '신규';
  if (status === 'UNCHANGED') return '변경';
  return PLACEHOLDER;
};

const COLUMNS: readonly { label: string; widthClass?: string }[] = [
  { label: '#', widthClass: 'w-9' },
  { label: 'DB Type' },
  { label: 'Resource ID' },
  { label: 'Region' },
  { label: 'DB Name' },
  { label: '연동 대상 여부' },
  { label: '스캔 이력' },
];

export const WaitingApprovalTable = ({ resources }: WaitingApprovalTableProps) => {
  if (resources.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        표시할 리소스가 없습니다.
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
          {resources.map((resource, index) => (
            <tr key={resource.resourceId} className={tableStyles.row}>
              <td className={cn(tableStyles.cell, 'tabular-nums text-sm', textColors.secondary)}>
                {index + 1}
              </td>
              <td className={tableStyles.cell}>
                <Badge variant="info" size="sm">{resource.resourceType}</Badge>
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {resource.resourceId}
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {resource.region || PLACEHOLDER}
              </td>
              <td className={cn(tableStyles.cell, 'font-mono text-[12px]', textColors.secondary)}>
                {resource.databaseName || PLACEHOLDER}
              </td>
              <td
                className={cn(
                  tableStyles.cell,
                  'text-sm',
                  resource.selected ? textColors.primary : textColors.tertiary,
                )}
              >
                {resource.selected ? '대상' : '비대상'}
              </td>
              <td className={cn(tableStyles.cell, 'text-sm', textColors.secondary)}>
                {formatScanStatus(resource.scanStatus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
