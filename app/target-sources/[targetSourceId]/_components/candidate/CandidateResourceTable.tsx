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
//
// IdentifierTip(변수: variant="value")과 같은 화이트 박스 가족. 계층 3단 —
// 캡션(11px 회색 제목) < 본문(12px #4E5968) < 용어(13px bold #191F28) — 로
// 용어가 제목보다 크게 읽힌다: 사용자가 찾으러 온 것은 "안내"가 아니라 자기
// 행에 찍힌 그 단어다. 제목 구역과 용어 구역은 헤어라인으로 가른다.
const CATEGORY_TERMS = [
  {
    term: '설치 대상',
    description:
      '연동하려면 Agent 설치(4단계)가 진행되는 DB예요. 연동에서 제외하려면 제외 사유를 입력해야 해요.',
  },
  {
    term: '설치 선택',
    description:
      'VM·EC2처럼 DB 외 다른 용도로도 쓰는 리소스라 필수 연동 대상은 아니에요. DB 서버를 운영하고 있다면 연동 대상이 맞아요. 행을 펼쳐 데이터베이스 설정을 저장하면 선택할 수 있어요.',
  },
  {
    term: '설치 불가',
    description:
      '네트워크 구성 제약으로 Agent를 설치할 수 없는 리소스예요. 선택할 수 없고, 행의 설치 불가 라벨을 누르면 상세 사유를 확인할 수 있어요.',
  },
] as const;

const CATEGORY_TOOLTIP_CONTENT = (
  <div className="leading-[1.55]">
    <span className="block text-[14px] font-semibold text-[#191F28]">설치 구분 안내</span>
    <p className="mt-[4px] text-[12px] text-[#4E5968]">
      스캔 결과를 바탕으로 시스템이 판정하는 값이라 직접 변경할 수 없어요.
    </p>
    <div className="my-[10px] h-px bg-[#E5E8EB]" aria-hidden="true" />
    <div className="space-y-[10px]">
      {CATEGORY_TERMS.map(({ term, description }) => (
        <div key={term}>
          <span className="block text-[14px] font-bold text-[#191F28]">{term}</span>
          <p className="mt-[2px] text-[12px] text-[#4E5968]">{description}</p>
        </div>
      ))}
    </div>
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
                    variant="value"
                    label="설치 구분 안내"
                    iconSize={17}
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
