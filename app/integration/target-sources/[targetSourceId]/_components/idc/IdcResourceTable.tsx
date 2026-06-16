'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { bgColors, cn, idcStyles, textColors } from '@/lib/theme';
import { IDC_SOURCE_IP_TOOLTIP } from '@/lib/constants/idc';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  IdcConnBadge,
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcFirewallBadge,
  IdcHealthBadge,
  IdcKindBadge,
  IdcSourceIpCell,
  IdcTargetPill,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';

export type IdcTableCol = 'src' | 'excl' | 'fw' | 'conn' | 'health';

interface IdcResourceTableProps {
  resources: readonly IdcResourceView[];
  /** Column set per step (v15 `data-idc-cols`). `excl` also includes excluded rows. */
  cols: readonly IdcTableCol[];
  emptyMessage?: string;
}

const [TIP_TITLE, ...TIP_REST] = IDC_SOURCE_IP_TOOLTIP.split('\n');

const SourceIpHeader = () => (
  <span className="inline-flex items-center gap-1">
    Source IP
    <InfoTooltip
      content={
        <div className="max-w-[260px] space-y-1">
          <div className="font-bold">{TIP_TITLE}</div>
          <div className="text-[12px] leading-[1.5]">{TIP_REST.join(' ')}</div>
        </div>
      }
    />
  </span>
);

export const IdcResourceTable = ({ resources, cols, emptyMessage }: IdcResourceTableProps) => {
  const has = (c: IdcTableCol) => cols.includes(c);
  // Step 2·3 (`excl`) show excluded rows too; Step 4~7 show integration targets only.
  const rows = has('excl') ? resources : resources.filter((r) => !r.excluded);

  if (rows.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? '표시할 연동 대상이 없습니다.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className={idcStyles.table.header}>
          <tr>
            <th className={cn(idcStyles.table.headerCell, 'w-[110px]')}>구분</th>
            <th className={cn(idcStyles.table.headerCell, 'w-[220px]')}>연동 대상</th>
            <th className={cn(idcStyles.table.headerCell, 'w-[80px]')}>Port</th>
            <th className={idcStyles.table.headerCell}>Database Type</th>
            {has('src') && (
              <th className={cn(idcStyles.table.headerCell, 'w-[180px]')}>
                <SourceIpHeader />
              </th>
            )}
            {has('excl') && <th className={cn(idcStyles.table.headerCell, 'w-[180px]')}>연동 대상 여부</th>}
            {has('fw') && <th className={cn(idcStyles.table.headerCell, 'w-[170px]')}>방화벽 상태</th>}
            {has('conn') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Connection Status</th>}
            {has('health') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Status</th>}
          </tr>
        </thead>
        <tbody className={idcStyles.table.body}>
          {rows.map((r) => {
            const dim = r.excluded ? 'opacity-50' : '';
            return (
              <tr key={r.resourceId} className={cn(idcStyles.table.row, r.excluded && bgColors.muted)}>
                <td className={cn(idcStyles.table.cell, dim)}><IdcKindBadge kind={r.kind} /></td>
                <td className={cn(idcStyles.table.cell, dim)}><IdcEndpointCell resource={r} /></td>
                <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary, dim)}>{r.port}</td>
                <td className={cn(idcStyles.table.cell, dim)}><IdcDbTypeCell resource={r} /></td>
                {has('src') && (
                  <td className={cn(idcStyles.table.cell, dim)}>
                    {r.excluded ? <span className={textColors.quaternary}>—</span> : <IdcSourceIpCell sourceIps={r.sourceIps} />}
                  </td>
                )}
                {has('excl') && (
                  <td className={idcStyles.table.cell}>
                    {r.excluded ? (
                      <span className="inline-flex items-center gap-2">
                        <IdcTargetPill excluded />
                        {r.exclusionReason ? <ReasonChipInline reason={r.exclusionReason} /> : null}
                      </span>
                    ) : (
                      <IdcTargetPill excluded={false} />
                    )}
                  </td>
                )}
                {has('fw') && <td className={cn(idcStyles.table.cell, dim)}><IdcFirewallBadge open={r.firewallOpen} /></td>}
                {has('conn') && <td className={cn(idcStyles.table.cell, dim)}><IdcConnBadge state={r.connection} /></td>}
                {has('health') && <td className={cn(idcStyles.table.cell, dim)}><IdcHealthBadge health={r.health} /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
