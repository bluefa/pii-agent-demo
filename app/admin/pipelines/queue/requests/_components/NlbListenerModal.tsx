/**
 * NlbListenerModal — NLB 리스너 현황 (design-spec §3/§6). A wide TqModal with the
 * app res-tbl: NLB Index · NLB IP · 점유(n/50 + OccBar) · 상태(Ftag). Read-only —
 * the per-row NLB reassignment lives in the detail table, not here.
 */
'use client';

import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { OccBar, FtagBadge } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { NLB_CAPACITY } from '@/app/admin/pipelines/queue/requests/_logic';
import type { NlbTableRow } from '@/app/lib/api/task-queue-requests';

/** 대기 프레임의 행 수 — 몇 개인지가 바로 지금 오는 값이라, 흔한 규모로 세운다. */
const SKELETON_ROWS = 6;

/** 12px mono 값 한 칸의 자국 — 높이는 그 값의 줄 상자(12 × 1.4 = 16.8)를 올린 17. */
const VALUE_BAR = cn(pipelineStyles.skeletonBar, 'block h-[17px]');

export interface NlbListenerModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * 조회 중이면 `undefined`, 실패면 `null`. 빈 배열은 「NLB 가 하나도 없다」는 사실이라
   * 그 둘 중 어느 것도 빈 표로 접지 않는다 — 그러면 세 결말이 같은 픽셀을 그린다.
   */
  rows: readonly NlbTableRow[] | null | undefined;
}

export function NlbListenerModal({
  open,
  onClose,
  rows,
}: NlbListenerModalProps): ReactElement {
  const { appTable, occ } = tqStyles;
  const loading = rows === undefined;

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
      {rows === null ? (
        /* 실패는 제 문장을 갖는다 — 빈 표를 그리면 화면이 「NLB 가 없다」고 단언한다.
           조회하지 못한 것과 없는 것은 다른 사실이다. */
        <p className="px-5 py-8 text-center text-[14px] text-[var(--pl-text-weak)]">
          NLB 리스너 현황을 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      ) : (
        /* Same 40 rows as NlbAssignModal, so the same cap: without it the modal shell scrolls
           as one and the title, the column names and the 닫기 button all leave the screen. */
        <div className={appTable.wrap} {...(loading ? { 'aria-busy': true } : {})}>
          <div className="max-h-[44vh] overflow-y-auto">
            {loading && <span className="sr-only">불러오는 중</span>}
            <table className={appTable.root}>
              <thead className={cn(appTable.thead, 'sticky top-0 z-10')}>
                <tr>
                  <th className={`${appTable.th} w-[100px]`}>NLB Index</th>
                  <th className={appTable.th}>NLB IP</th>
                  <th className={`${appTable.th} w-[240px]`}>점유 리스너</th>
                  <th className={`${appTable.th} w-[100px]`}>상태</th>
                </tr>
              </thead>
              <tbody className={appTable.body}>
                {loading
                  ? /* 열 이름은 이 모달이 이미 아는 고정 문자열이라 실물로 서고, 값만
                       막대다 (`StatusCardSkeleton` 의 규칙). 막대는 그 칸에 실제로 서는
                       것을 흉내낸다 — mono 12px 값은 제 줄 상자(17), 점유 막대는 OccBar 의
                       6px.
                       상태 칸의 21px 은 Ftag 알약의 높이(18.8)가 아니라 **행 높이**다:
                       정착본 행은 47.8px 이고, 그 20.8px 은 점유 칸의 inline-flex 가
                       baseline 정렬로 만드는 줄 상자다(브라우저 실측). 알약의 실제 높이를
                       쓰면 자국 행이 2px 낮아져 값이 도착할 때 표가 늘어난다. */
                    Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <tr key={index} aria-hidden>
                        <td className={appTable.td}>
                          <span className={cn(VALUE_BAR, 'w-[36px] rounded')} />
                        </td>
                        <td className={appTable.td}>
                          <span className={cn(VALUE_BAR, 'w-[104px] rounded')} />
                        </td>
                        <td className={appTable.td}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={cn(pipelineStyles.skeletonBar, 'block h-1.5 w-24 rounded-full')}
                            />
                            <span className={cn(VALUE_BAR, 'w-[38px] rounded')} />
                          </span>
                        </td>
                        <td className={appTable.td}>
                          <span
                            className={cn(pipelineStyles.skeletonBar, 'block h-[21px] w-[52px] rounded-full')}
                          />
                        </td>
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr key={row.nlbIndex} className={appTable.row}>
                        <td className={`${appTable.td} ${appTable.tdMono}`}>#{row.nlbIndex}</td>
                        <td className={`${appTable.td} ${appTable.tdMono}`}>
                          {row.nlbIpList.join(' · ')}
                        </td>
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
        </div>
      )}
    </TqModal>
  );
}
