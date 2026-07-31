'use client';

import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  textColors,
} from '@/lib/theme';
import type { CandidateDraftState, CandidateResource } from '@/lib/types/resources';
import {
  CandidateResourceRow,
  type CandidateRowActions,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceRow';

interface CandidateResourceTableProps {
  candidates: CandidateResource[];
  selectedIds: Set<string>;
  /** id → exclusion reason for the currently-excluded (unselected) resources. */
  exclusionReasons: Record<string, string>;
  drafts: CandidateDraftState;
  expandedResourceId: string | null;
  readonly: boolean;
  actions: CandidateRowActions;
}

export const CandidateResourceTable = ({
  candidates,
  selectedIds,
  exclusionReasons,
  drafts,
  expandedResourceId,
  readonly,
  actions,
}: CandidateResourceTableProps) => {
  const totalCount = candidates.length;
  const showCheckboxColumn = !readonly;

  if (totalCount === 0) {
    return (
      <div className={cn('rounded-lg border px-6 py-10 text-center text-sm', bgColors.surface, borderColors.default, textColors.tertiary)}>
        발견된 리소스가 없습니다
      </div>
    );
  }

  return (
    <div className={idcStyles.table.frame}>
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
              <th className={idcStyles.table.approvalHeaderCell}>설치 구분</th>
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
