'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { cn, idcStyles, textColors } from '@/lib/theme';
import type { IdcInstallStatus, IdcResourceView } from '@/app/lib/api/idc';
import {
  IdcEndpointCell,
  IdcFirewallBadge,
  IdcSourceIpCell,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';

interface IdcFirewallModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Step 4 resource list (DR7 — injected, never fetched here). */
  resources: readonly IdcResourceView[];
  /**
   * Per-resource firewall step status keyed by resourceId, from the
   * installation-status `firewall_check.status` (same join as the Step-4 `fw`
   * column). A missing entry renders the neutral "BDC측 확인 필요" badge.
   */
  firewallStatusByResource?: Readonly<Record<string, IdcInstallStatus>>;
}

/**
 * IDC 방화벽 확인 모달 (v15 L8151~8178, `openIdcFirewallModal` L10333).
 *
 * One row per integration target (excluded rows dropped, #39). Each row reads
 * Source IP → 연동 대상 → Port → 오픈 여부. The 오픈 여부 badge is driven by the
 * installation-status firewall_check.status of the SAME resource (joined by
 * resource_id); the confirmed-integration rows carry no firewall field.
 */
export const IdcFirewallModal = ({
  isOpen,
  onClose,
  resources,
  firewallStatusByResource,
}: IdcFirewallModalProps) => {
  const rows = resources.filter((r) => !r.excluded);

  const { page, pageSize, setPage, setPageSize, pageItems: pageRows } = usePagination(rows, {
    initialPageSize: 10,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="방화벽 확인"
      subtitle="Source IP → 연동 대상 방화벽 오픈 여부를 확인합니다."
      size="2xl"
      chrome="toss"
      footer={<button type="button" className={idcStyles.modalBtn.primary} onClick={onClose}>확인</button>}
    >
      {rows.length === 0 ? (
        <div className={cn('px-2 py-8 text-center text-sm', textColors.tertiary)}>
          확인할 연동 대상이 없습니다.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={idcStyles.table.header}>
                <tr>
                  <th className={cn(idcStyles.table.headerCell, 'w-[160px]')}>Source IP</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[30px]')} aria-hidden="true" />
                  <th className={cn(idcStyles.table.headerCell, 'w-[220px]')}>연동 대상</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[70px]')}>Port</th>
                  <th className={cn(idcStyles.table.headerCell, 'w-[170px]')}>오픈 여부</th>
                </tr>
              </thead>
              <tbody className={idcStyles.table.body}>
                {pageRows.map((r) => (
                  <tr key={r.resourceId} className={idcStyles.table.row}>
                    <td className={idcStyles.table.cell}>
                      <IdcSourceIpCell sourceIps={r.sourceIps} />
                    </td>
                    <td className={cn(idcStyles.table.cell, 'text-center', textColors.quaternary)}>
                      →
                    </td>
                    <td className={idcStyles.table.cell}>
                      <IdcEndpointCell resource={r} />
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {r.port}
                    </td>
                    <td className={idcStyles.table.cell}>
                      <IdcFirewallBadge status={firewallStatusByResource?.[r.resourceId]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={rows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          )}
        </>
      )}
    </Modal>
  );
};
