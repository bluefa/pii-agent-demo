'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { bgColors, cn, idcStyles, tableStyles, textColors } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import { HealthBadge } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/HealthBadge';
import { deriveHealth } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';

export type ConfirmedIntegrationTableVariant = 'pre-install' | 'complete';

interface ConfirmedIntegrationTableProps {
  confirmed: readonly ConfirmedResource[];
  variant?: ConfirmedIntegrationTableVariant;
}

const LOGICAL_DB_PLACEHOLDER = '—';

const STATUS_TOOLTIP_CONTENT = (
  <div className="space-y-2 text-[12px] leading-[1.5]">
    <div className="font-semibold">Status 안내</div>
    <div className="flex items-start gap-2">
      <HealthBadge status="healthy" />
      <span>모든 DB가 정상이에요.</span>
    </div>
    <div className="flex items-start gap-2">
      <HealthBadge status="unhealthy" />
      <span>DB가 비정상이에요. Agent 또는 Credential 상태를 확인해주세요.</span>
    </div>
  </div>
);

export const ConfirmedIntegrationTable = ({
  confirmed,
  variant = 'pre-install',
}: ConfirmedIntegrationTableProps) => {
  if (confirmed.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }

  const headerCellClass = cn(
    tableStyles.headerCell,
    'text-left text-xs font-medium',
    textColors.tertiary,
  );
  const cellClass = cn(tableStyles.cell, 'text-xs', textColors.tertiary);
  const monoCellClass = cn(tableStyles.cell, 'font-mono text-xs', textColors.secondary);

  if (variant === 'complete') {
    return (
      <table className="w-full text-sm">
        <thead className={bgColors.muted}>
          <tr>
            <th className={headerCellClass}>DB Type</th>
            <th className={headerCellClass}>Resource ID</th>
            <th className={headerCellClass}>DB Credential</th>
            <th className={headerCellClass}>연동 대상 논리 DB</th>
            <th className={headerCellClass}>연동 제외 논리 DB</th>
            <th className={headerCellClass}>
              <span className="inline-flex items-center gap-1">
                Status
                <InfoTooltip content={STATUS_TOOLTIP_CONTENT} position="top" size="md" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {confirmed.map((resource) => (
            <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
              <td className={cellClass}>{resource.databaseType ?? '-'}</td>
              <td className={monoCellClass}>
                <span className="inline-flex items-center gap-1">
                  <span>{resource.resourceId}</span>
                  <CopyButton
                    value={resource.resourceId}
                    label={`${resource.resourceId} 복사`}
                    className="opacity-0 group-hover:opacity-100"
                  />
                </span>
              </td>
              <td className={cellClass}>{resource.credentialId ?? '-'}</td>
              <td className={cellClass}>{LOGICAL_DB_PLACEHOLDER}</td>
              <td className={cellClass}>{LOGICAL_DB_PLACEHOLDER}</td>
              <td className={tableStyles.cell}>
                <HealthBadge status={deriveHealth(resource)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className={bgColors.muted}>
        <tr>
          <th className={headerCellClass}>Database Type</th>
          <th className={headerCellClass}>Resource ID</th>
          <th className={headerCellClass}>Region</th>
          <th className={headerCellClass}>Resource Name</th>
          <th className={headerCellClass}>DB Credential</th>
          <th className={headerCellClass}>Connection Status</th>
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {confirmed.map((resource) => (
          <tr key={resource.resourceId} className={cn(tableStyles.row, 'group')}>
            <td className={cellClass}>{resource.databaseType ?? '-'}</td>
            <td className={monoCellClass}>
              <span className="inline-flex items-center gap-1">
                <span>{resource.resourceId}</span>
                <CopyButton
                  value={resource.resourceId}
                  label={`${resource.resourceId} 복사`}
                  className="opacity-0 group-hover:opacity-100"
                />
              </span>
            </td>
            <td className={cellClass}>{resource.region ?? '-'}</td>
            <td className={cellClass}>{resource.resourceName ?? '-'}</td>
            <td className={cellClass}>{resource.credentialId ?? '-'}</td>
            <td className={tableStyles.cell}>
              <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>Success</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
