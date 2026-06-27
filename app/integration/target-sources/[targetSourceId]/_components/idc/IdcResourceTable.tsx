'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { IDC_SOURCE_IP_TOOLTIP } from '@/lib/constants/idc';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  IdcConnBadge,
  IdcConnStatusCell,
  IdcCredSelectCell,
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcFirewallBadge,
  IdcHealthBadge,
  IdcKindBadge,
  IdcLogicalButtonCell,
  IdcSourceIpCell,
  IdcTargetPill,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';

export type IdcTableCol = 'src' | 'excl' | 'fw' | 'conn' | 'health' | 'cred' | 'credro' | 'logical';

interface IdcResourceTableProps {
  resources: readonly IdcResourceView[];
  /** Column set per step (v15 `data-idc-cols`). `excl` also includes excluded rows. */
  cols: readonly IdcTableCol[];
  emptyMessage?: string;
  /** Step-5: DB Credential select change (resourceId, credential). */
  onCredChange?: (resourceId: string, cred: string) => void;
  /** Step-5: credential options loaded from `GET .../secrets`. */
  credOptions?: readonly string[];
  /** Step-5/6: open the per-resource logical-DB modal. */
  onLogicalOpen?: (resource: IdcResourceView) => void;
}

const [TIP_TITLE, ...TIP_REST] = IDC_SOURCE_IP_TOOLTIP.split('\n');

const SourceIpHeader = () => (
  <span className="inline-flex items-center gap-1">
    Source IP
    <InfoTooltip
      variant="sourceIp"
      content={
        <div className="space-y-1">
          <div className="font-bold">{TIP_TITLE}</div>
          <div>{TIP_REST.join(' ')}</div>
        </div>
      }
    />
  </span>
);

export const IdcResourceTable = ({
  resources,
  cols,
  emptyMessage,
  onCredChange,
  credOptions = [],
  onLogicalOpen,
}: IdcResourceTableProps) => {
  const has = (c: IdcTableCol) => cols.includes(c);
  // Step 2·3 (`excl`) show excluded rows too; Step 4~7 show integration targets only.
  const rows = has('excl') ? resources : resources.filter((r) => !r.excluded);

  // Display-only pagination; per-step gating runs over the full list in the step
  // components, so slicing the view here is safe.
  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(rows, {
    initialPageSize: 10,
  });

  if (rows.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? '표시할 연동 대상이 없습니다.'}
      </div>
    );
  }

  return (
    <>
    <div className={idcStyles.table.frame}>
      <table className="w-full">
        <thead className={idcStyles.table.header}>
          <tr>
            <th className={cn(idcStyles.table.headerCell, 'w-[110px]')}>구분</th>
            <th className={cn(idcStyles.table.headerCell, 'w-[168px]')}>연동 대상</th>
            <th className={cn(idcStyles.table.headerCell, 'w-[80px]')}>Port</th>
            <th className={idcStyles.table.headerCell}>Database Type</th>
            {has('src') && (
              <th className={cn(idcStyles.table.headerCell, 'w-[190px]')}>
                <SourceIpHeader />
              </th>
            )}
            {has('excl') && <th className={cn(idcStyles.table.headerCell, 'w-[230px]')}>연동 대상 / 제외 사유</th>}
            {has('fw') && <th className={cn(idcStyles.table.headerCell, 'w-[170px]')}>방화벽 상태</th>}
            {has('cred') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>DB Credential</th>}
            {has('credro') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>DB Credential</th>}
            {has('conn') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Connection Status</th>}
            {has('logical') && <th className={cn(idcStyles.table.headerCell, 'w-[110px]')}>논리 DB 관리</th>}
            {has('health') && <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Status</th>}
          </tr>
        </thead>
        <tbody className={idcStyles.table.body}>
          {pageRows.map((r) => {
            const dim = r.excluded ? 'opacity-50' : '';
            return (
              <tr key={r.resourceId} className={cn(idcStyles.table.row, r.excluded && 'bg-[#F7F8FA]')}>
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
                {has('cred') && (
                  <td className={idcStyles.table.cell}>
                    {r.excluded ? (
                      <span className={textColors.quaternary}>—</span>
                    ) : (
                      <IdcCredSelectCell
                        value={r.credentialId ?? ''}
                        onChange={(cred) => onCredChange?.(r.resourceId, cred)}
                        options={[...credOptions]}
                      />
                    )}
                  </td>
                )}
                {has('credro') && (
                  <td className={idcStyles.table.cell}>
                    {r.excluded || !r.credentialId ? (
                      <span className={textColors.quaternary}>—</span>
                    ) : (
                      <span className={cn('font-mono text-[12px] font-semibold', textColors.primary)}>
                        {r.credentialId}
                      </span>
                    )}
                  </td>
                )}
                {has('conn') && (
                  <td className={cn(idcStyles.table.cell, dim)}>
                    {/* Credential-aware status whenever a credential column is present (step-5 `cred`,
                        step-6 `credro`): no cred -> '자격 증명 필요', cred+SUCCESS -> Success, else Pending
                        (v16 idcConnBadge). Steps without a credential column keep the plain badge. */}
                    {has('cred') || has('credro') ? (
                      <IdcConnStatusCell resource={r} />
                    ) : (
                      <IdcConnBadge state={r.connection} />
                    )}
                  </td>
                )}
                {has('logical') && (
                  <td className={idcStyles.table.cell}>
                    {r.excluded ? (
                      <span className={textColors.quaternary}>—</span>
                    ) : (
                      <IdcLogicalButtonCell resource={r} onOpen={() => onLogicalOpen?.(r)} />
                    )}
                  </td>
                )}
                {has('health') && <td className={cn(idcStyles.table.cell, dim)}><IdcHealthBadge health={r.health} /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <Pagination
      page={page}
      pageSize={pageSize}
      totalCount={rows.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      pageSizeOptions={[10, 20, 50, 100]}
      controls="prevNext"
    />
    </>
  );
};
