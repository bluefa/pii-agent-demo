'use client';

import { cn, bgColors, tableStyles, textColors } from '@/lib/theme';
import type { ApprovedResource } from '@/lib/types/resources';

interface ApprovedIntegrationTableProps {
  approved: readonly ApprovedResource[];
}

export const ApprovedIntegrationTable = ({ approved }: ApprovedIntegrationTableProps) => {
  if (approved.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        반영 중인 리소스가 없습니다.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className={bgColors.muted}>
        <tr>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            리소스 ID
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            유형
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            DB 타입
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            Credential
          </th>
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {approved.map((resource) => (
          <tr key={resource.resourceId} className={tableStyles.row}>
            <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.secondary)}>
              {resource.resourceId}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.type}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.databaseType ?? '-'}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.credentialId ?? '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
