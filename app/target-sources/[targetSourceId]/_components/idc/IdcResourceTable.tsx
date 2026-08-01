'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { IDC_SOURCE_IP_TOOLTIP } from '@/lib/constants/idc';
import type { IdcInstallStatus, IdcResourceView } from '@/app/lib/api/idc';
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
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { LogicalDbCountMap } from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';

export type IdcTableCol =
  | 'src'
  | 'excl'
  | 'fw'
  | 'conn'
  | 'health'
  | 'cred'
  | 'logical'
  /** Step 6 — the Step 5 logical-DB result as two read-only count columns (연동 논리 DB / 연동 제외). */
  | 'logicalro';

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
  /**
   * `logicalro` column only — per-resource Step 5 counts from the test-connection
   * latest-results. A resource absent from the map renders "—", never a fabricated 0.
   */
  logicalDbCounts?: LogicalDbCountMap;
  /**
   * Render in the CSP approval-table skin (step 6): the borderless frame that joins under a
   * toolbar, the 12px/600 approval header, 18/16 cell padding and the readable row-hover lift.
   * Pagination moves to the caller, which owns the toolbar's filter state — same contract as
   * WaitingApprovalTable's own `connected`.
   */
  connected?: boolean;
  /**
   * Step-4 `fw` column only: per-resource firewall step status keyed by
   * resourceId, sourced from the installation-status `firewall_check.status`
   * (the confirmed-integration rows have no firewall field). A missing entry
   * renders the neutral "BDC측 확인 필요" badge.
   */
  firewallStatusByResource?: Readonly<Record<string, IdcInstallStatus>>;
}

const [TIP_TITLE, ...TIP_REST] = IDC_SOURCE_IP_TOOLTIP.split('\n');

const SourceIpHeader = () => (
  <span className="inline-flex items-center gap-1">
    Source IP
    <InfoTooltip
      // Light `value` box, the same one the 연동 대상 cell tooltip uses — one table should not
      // answer a hover with a dark popover in one column and a light one in another.
      variant="value"
      // 17px — the table-header (?) size set by CSP step 1 (CandidateResourceTable). The
      // component default is 13, which reads as a different control next to the same header.
      iconSize={17}
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
  logicalDbCounts,
  connected = false,
  firewallStatusByResource,
}: IdcResourceTableProps) => {
  const has = (c: IdcTableCol) => cols.includes(c);
  // Step 2·3 (`excl`) show excluded rows too; Step 4~7 show integration targets only.
  const rows = has('excl') ? resources : resources.filter((r) => !r.excluded);

  // Display-only pagination; per-step gating runs over the full list in the step
  // components, so slicing the view here is safe.
  const { page, pageSize, setPage, setPageSize, pageItems: paged } = usePagination(rows, {
    initialPageSize: 10,
  });
  // `connected` callers slice the list themselves (their toolbar owns the filter state), so the
  // internal pager is bypassed rather than rendered twice.
  const pageRows = connected ? rows : paged;

  const skin = connected
    ? {
        frame: CONNECTED_FRAME,
        header: idcStyles.table.approvalHeader,
        headerCell: idcStyles.table.approvalHeaderCell,
        cell: idcStyles.table.approvalCell,
      }
    : {
        frame: idcStyles.table.frame,
        header: idcStyles.table.header,
        headerCell: idcStyles.table.headerCell,
        cell: idcStyles.table.cell,
      };

  if (rows.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? '표시할 연동 대상이 없습니다.'}
      </div>
    );
  }

  return (
    <>
    <div className={skin.frame}>
      <table className="w-full">
        <thead className={skin.header}>
          <tr>
            <th className={cn(skin.headerCell, 'w-[110px]')}>구분</th>
            <th className={cn(skin.headerCell, 'w-[168px]')}>연동 대상</th>
            <th className={cn(skin.headerCell, 'w-[80px]')}>Port</th>
            {/* Declared, not auto. As the only un-widthed column it was the slack sink: with the
                six columns of steps 2·3 it rendered 306px against the 172px it takes on step 6,
                so the same four leading columns did not line up between steps. 172 is step 6's
                own width — the widest engine label plus its SID line fits. */}
            <th className={cn(skin.headerCell, 'w-[172px]')}>Database Type</th>
            {has('src') && (
              <th className={cn(skin.headerCell, 'w-[144px]')}>
                <SourceIpHeader />
              </th>
            )}
            {/* Two columns, not one merged cell: the verdict and the why answer different
                questions, which is how the cloud steps 2·3 table asks them. */}
            {has('excl') && (
              <>
                <th className={cn(skin.headerCell, 'w-[112px]')}>요청 대상 여부</th>
                {/* The flexible one on these steps: the reason is the only free-text value in a
                    row, so leftover width belongs to it, not to an attribute column. */}
                <th className={skin.headerCell}>제외 사유</th>
              </>
            )}
            {has('fw') && <th className={skin.headerCell}>방화벽 상태</th>}
            {has('cred') && <th className={cn(skin.headerCell, 'w-[150px]')}>DB Credential</th>}
            {has('conn') && <th className={cn(skin.headerCell, 'w-[150px]')}>Connection Status</th>}
            {has('logical') && <th className={cn(skin.headerCell, 'w-[110px]')}>논리 DB 관리</th>}
            {has('logicalro') && (
              <>
                <th className={cn(skin.headerCell, 'w-[120px]')}>연동 논리 DB</th>
                <th className={skin.headerCell}>연동 제외</th>
              </>
            )}
            {has('health') && <th className={skin.headerCell}>Status</th>}
          </tr>
        </thead>
        <tbody className={idcStyles.table.body}>
          {pageRows.map((r) => {
            const dim = r.excluded ? 'opacity-50' : '';
            return (
              <tr
                key={r.resourceId}
                className={
                  connected
                    ? cn(ROW_BASE, r.excluded ? ROW_EXCLUDED : ROW_TARGET)
                    : cn(idcStyles.table.row, r.excluded && 'bg-[#F7F8FA]')
                }
              >
                {/* Same rule as the host and port cells: rows from ExcludedResourceInfoDto carry
                    no endpoint at all, and the adapter's fallback 'SINGLE' would assert an
                    endpoint shape nobody reported. */}
                <td className={cn(skin.cell, dim)}>
                  {r.hosts.length > 0 ? (
                    <IdcKindBadge kind={r.kind} />
                  ) : (
                    <span className={textColors.quaternary}>—</span>
                  )}
                </td>
                <td className={cn(skin.cell, dim)}><IdcEndpointCell resource={r} /></td>
                {/* 0 is the adapter's "no port in the payload" value, not a port — an em-dash
                    says the field is missing instead of asserting a nonsense one. */}
                <td className={cn(skin.cell, 'font-mono text-[12px]', textColors.secondary, CELL_LIFT, dim)}>
                  {r.port || <span className={textColors.quaternary}>—</span>}
                </td>
                <td className={cn(skin.cell, dim)}><IdcDbTypeCell resource={r} /></td>
                {has('src') && (
                  <td className={cn(skin.cell, dim)}>
                    {r.excluded ? <span className={textColors.tertiary}>—</span> : <IdcSourceIpCell sourceIps={r.sourceIps} />}
                  </td>
                )}
                {has('excl') && (
                  <>
                    <td className={skin.cell}>
                      <TargetPill excluded={r.excluded} />
                    </td>
                    {/* Blank, not an em-dash: a 대상 row can never carry a reason. The chip is
                        clamped to the same 15 chars the cloud table uses — the full text is in
                        its hover tip. */}
                    <td className={cn(skin.cell, 'text-sm')}>
                      {r.excluded && r.exclusionReason ? (
                        <ReasonChipInline
                          reason={r.exclusionReason}
                          summary={clampReason(r.exclusionReason)}
                        />
                      ) : null}
                    </td>
                  </>
                )}
                {has('fw') && <td className={cn(skin.cell, dim)}><IdcFirewallBadge status={firewallStatusByResource?.[r.resourceId]} /></td>}
                {has('cred') && (
                  <td className={skin.cell}>
                    {r.excluded ? (
                      <span className={textColors.tertiary}>—</span>
                    ) : (
                      <IdcCredSelectCell
                        value={r.credentialId ?? ''}
                        onChange={(cred) => onCredChange?.(r.resourceId, cred)}
                        options={[...credOptions]}
                      />
                    )}
                  </td>
                )}
                {has('conn') && (
                  <td className={cn(skin.cell, dim)}>
                    {/* Credential-aware status whenever the credential column is present (step-5
                        `cred`): no cred -> '자격 증명 필요', cred+SUCCESS -> Success, else Pending
                        (v16 idcConnBadge). Steps without a credential column keep the plain badge. */}
                    {has('cred') ? (
                      <IdcConnStatusCell resource={r} />
                    ) : (
                      <IdcConnBadge state={r.connection} />
                    )}
                  </td>
                )}
                {has('logical') && (
                  <td className={skin.cell}>
                    {r.excluded ? (
                      <span className={textColors.tertiary}>—</span>
                    ) : (
                      <IdcLogicalButtonCell resource={r} onOpen={() => onLogicalOpen?.(r)} />
                    )}
                  </td>
                )}
                {has('logicalro') && (
                  <>
                    <td className={skin.cell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.target ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 논리 DB 목록 보기`}
                        onOpen={() => onLogicalOpen?.(r)}
                      />
                    </td>
                    <td className={skin.cell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.excluded ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 제외 대상 보기`}
                        onOpen={() => onLogicalOpen?.(r)}
                      />
                    </td>
                  </>
                )}
                {has('health') && <td className={cn(skin.cell, dim)}><IdcHealthBadge health={r.health} /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {!connected && (
    <Pagination
      page={page}
      pageSize={pageSize}
      totalCount={rows.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      pageSizeOptions={[10, 20, 50, 100]}
      controls="prevNext"
    />
    )}
    </>
  );
};
