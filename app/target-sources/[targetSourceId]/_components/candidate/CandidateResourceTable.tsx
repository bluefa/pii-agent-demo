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
    <div>
      <div className={idcStyles.table.frame}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={idcStyles.table.header}>
              <tr className="whitespace-nowrap">
                {showCheckboxColumn && <th className={cn(idcStyles.table.headerCell, 'w-10')} />}
                <th className={idcStyles.table.headerCell}>연동 대상 여부</th>
                <th className={idcStyles.table.headerCell}>Database Type</th>
                <th className={idcStyles.table.headerCell}>Resource ID</th>
                <th className={idcStyles.table.headerCell}>Region</th>
                <th className={idcStyles.table.headerCell}>Resource Name</th>
                {showCheckboxColumn && <th className={idcStyles.table.headerCell}>제외 사유</th>}
                <th className={idcStyles.table.headerCell}>연동 완료 여부</th>
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
    </div>
  );
};
