'use client';

import { cn, idcStyles } from '@/lib/theme';
import type { CandidateDraftState, CandidateResource } from '@/lib/types/resources';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import {
  CandidateResourceRow,
  type CandidateRowActions,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';
import { TableEmptyState } from '@/app/target-sources/[targetSourceId]/_components/shared/TableEmptyState';

// 설치 구분 = 스캔이 판정한 시스템 사실(사용자 변경 불가). 값의 뜻만이 아니라
// 각 값이 선택에 거는 규칙(대상 제외 시 사유 필수, 불가는 선택 자체 불가)까지가
// 한 세트다 — 사유 입력·비활성 체크박스를 만난 사용자가 여기서 이유를 찾는다.
const CATEGORY_TOOLTIP_CONTENT = (
  <div className="space-y-2 text-[12px] leading-[1.5]">
    <div className="font-semibold">설치 구분 안내</div>
    <p>스캔 결과를 바탕으로 시스템이 판정하는 값이라 직접 변경할 수 없어요.</p>
    <p>
      <span className="font-semibold">설치 대상</span> — 연동하려면 Agent 설치(4단계)가 진행되는
      DB예요. 연동에서 제외하려면 제외 사유를 입력해야 해요.
    </p>
    <p>
      <span className="font-semibold">설치 불필요</span> — VM(EC2 등)에 직접 설치해 운영하는
      DB처럼 별도 Agent 설치 없이 연동할 수 있는 리소스예요.
    </p>
    <p>
      <span className="font-semibold">설치 불가</span> — 네트워크 구성 제약으로 Agent를 설치할 수
      없는 리소스예요. 선택할 수 없고, 행의 설치 불가 라벨을 누르면 상세 사유를 확인할 수 있어요.
    </p>
  </div>
);

interface CandidateResourceTableProps {
  candidates: CandidateResource[];
  selectedIds: Set<string>;
  /** id → exclusion reason for the currently-excluded (unselected) resources. */
  exclusionReasons: Record<string, string>;
  drafts: CandidateDraftState;
  expandedResourceId: string | null;
  readonly: boolean;
  actions: CandidateRowActions;
  /** Shown when the (filtered) list is empty — the section passes the filter-empty copy. */
  emptyMessage?: string;
}

export const CandidateResourceTable = ({
  candidates,
  selectedIds,
  exclusionReasons,
  drafts,
  expandedResourceId,
  readonly,
  actions,
  emptyMessage,
}: CandidateResourceTableProps) => {
  const totalCount = candidates.length;
  const showCheckboxColumn = !readonly;

  if (totalCount === 0) {
    return <TableEmptyState message={emptyMessage ?? '발견된 리소스가 없습니다'} />;
  }

  return (
    // Step 2's connected grammar, not idcStyles.table.frame: no border/shadow/radius —
    // the toolbar above owns the rounded top, the Pagination footer below owns the
    // rounded bottom, and everything between stays bare (step-2 table silhouette).
    <div className="overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={idcStyles.table.approvalHeader}>
            {/* Identity (name → id) → attributes (type · region) → system verdict
                (설치 구분 = integration_category, a FACT the user cannot change) →
                user decision (checkbox + 제외 사유). The two axes never share a word
                family: 분류 speaks 설치-, selection speaks 연동 요청-. The checkbox IS
                the selection verdict, so there is no 대상/비대상 badge column. */}
            <tr className="whitespace-nowrap">
              {showCheckboxColumn && <th className={cn(idcStyles.table.approvalHeaderCell, 'w-10')} />}
              <th className={idcStyles.table.approvalHeaderCell}>Resource Name</th>
              <th className={idcStyles.table.approvalHeaderCell}>Resource ID</th>
              <th className={idcStyles.table.approvalHeaderCell}>Database Type</th>
              <th className={idcStyles.table.approvalHeaderCell}>Region</th>
              <th className={idcStyles.table.approvalHeaderCell}>
                <span className="inline-flex items-center gap-1">
                  설치 구분
                  <InfoTooltip
                    content={CATEGORY_TOOLTIP_CONTENT}
                    position="top"
                    size="md"
                    label="설치 구분 안내"
                  />
                </span>
              </th>
              {showCheckboxColumn && <th className={idcStyles.table.approvalHeaderCell}>제외 사유</th>}
            </tr>
          </thead>
          <tbody className={idcStyles.table.body}>
            {candidates.map((candidate) => (
              <CandidateResourceRow
                key={candidate.id}
                candidate={candidate}
                isSelected={selectedIds.has(candidate.id)}
                exclusionReason={exclusionReasons[candidate.id]}
                isExpanded={expandedResourceId === candidate.id}
                readonly={readonly}
                drafts={drafts}
                actions={actions}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
