/**
 * NlbListenerModal — NLB 리스너 현황 (design-spec §3/§6). A wide TqModal with the
 * app res-tbl: NLB Index · NLB IP · 점유(n/50 + OccBar) · 상태(Ftag). Read-only —
 * the per-row NLB reassignment lives in the detail table, not here.
 */
'use client';

import type { ReactElement } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { OccBar, FtagBadge } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { NLB_CAPACITY } from '@/app/admin/pipelines/queue/requests/_logic';
import type { NlbTableRow } from '@/app/lib/api/task-queue-requests';

export interface NlbListenerModalProps {
  open: boolean;
  onClose: () => void;
  rows: NlbTableRow[];
}

export function NlbListenerModal({
  open,
  onClose,
  rows,
}: NlbListenerModalProps): ReactElement {
  const { appTable, occ } = tqStyles;
  return (
    <TqModal
      open={open}
      onClose={onClose}
      wide
      title="NLB 리스너 현황"
      sub="NLB별 리스너 점유량이에요. 여유 있는 NLB로 배정하면 부하를 나눌 수 있어요."
      footer={
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      }
    >
      <div className={appTable.wrap}>
        <table className={appTable.root}>
          <thead className={appTable.thead}>
            <tr>
              <th className={`${appTable.th} w-[100px]`}>NLB Index</th>
              <th className={appTable.th}>NLB IP</th>
              <th className={`${appTable.th} w-[240px]`}>점유 리스너</th>
              <th className={`${appTable.th} w-[100px]`}>상태</th>
            </tr>
          </thead>
          <tbody className={appTable.body}>
            {rows.map((row) => (
              <tr key={row.nlbIndex} className={appTable.row}>
                <td className={`${appTable.td} ${appTable.tdMono}`}>#{row.nlbIndex}</td>
                <td className={`${appTable.td} ${appTable.tdMono}`}>{row.nlbIpList.join(' · ')}</td>
                <td className={appTable.td}>
                  <span className="inline-flex items-center gap-2">
                    <OccBar occupied={row.occupiedListenerCount} />
                    <span className={occ.num}>
                      {row.occupiedListenerCount}
                      <span className={occ.den}>/{NLB_CAPACITY}</span>
                    </span>
                  </span>
                </td>
                <td className={appTable.td}>
                  <FtagBadge occupied={row.occupiedListenerCount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TqModal>
  );
}
