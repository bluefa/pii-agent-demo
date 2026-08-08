'use client';

import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { DeleteIcon, EditIcon } from '@/app/components/ui/icons';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
  verdictRailClass,
} from '@/lib/theme';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcKindBadge,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import {
  clampReason,
  CONNECTED_FRAME,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { TableEmptyState } from '@/app/target-sources/[targetSourceId]/_components/shared/TableEmptyState';

/** Working-list row = domain view + whether the exclusion reason is custom. */
export interface IdcStep1Row extends IdcResourceView {
  exclusionCustom: boolean;
}

interface IdcTargetListTableProps {
  rows: readonly IdcStep1Row[];
  /** Toggled the target checkbox; `anchor` positions the exclusion popover. */
  onToggle: (resourceId: string, checked: boolean, anchor: HTMLElement) => void;
  /** Clicked the reason chip on an excluded row → reopen the popover. */
  onReasonChipClick: (resourceId: string, anchor: HTMLElement) => void;
  onEdit: (resourceId: string) => void;
  onDelete: (resourceId: string) => void;
  /** Shown when the search/filter set matches nothing. */
  emptyMessage?: string;
}

// Checkbox → identity (구분 · 접속 주소 · Port) → attribute (Database Type) → decision (제외 사유)
// → row actions, the cloud step-1 order. The 연동 완료 여부 column is gone: every IDC adapter
// sets `done: null`, so it rendered an em-dash on every row of every list.
// Widths are declared for the approval skin's 18px horizontal cell padding — the old set was
// tuned for px-4 (32px) and left every fixed column narrower than its own content, so the browser
// re-flowed them and dumped the slack into Database Type (the only auto column). Port and 구분
// take the step-6 table's numbers for the same columns; the identity column is the one left auto,
// because hosts are the unbounded value here.
const HEADERS: ReadonlyArray<{ label: string; className?: string }> = [
  { label: '', className: 'w-[52px]' },
  { label: '구분', className: 'w-[110px]' },
  { label: '접속 주소' },
  { label: 'Port', className: 'w-[80px]' },
  { label: 'Database Type', className: 'w-[140px]' },
  { label: '제외 사유', className: 'w-[190px]' },
  { label: '', className: 'w-[84px]' },
];

/**
 * Step 1 editable target table. Same skin as the cloud step-1 candidate table: no frame of its
 * own (the toolbar above owns the rounded top, the pager below the rounded bottom), the 12px/600
 * approval header, and the row hover/focus lift that marks the row a user is working in.
 * Excluded rows carry a left rail and a clickable reason; row hover reveals 수정 / 삭제.
 */
export const IdcTargetListTable = ({
  rows,
  onToggle,
  onReasonChipClick,
  onEdit,
  onDelete,
  emptyMessage,
}: IdcTargetListTableProps) => {
  if (rows.length === 0) {
    return <TableEmptyState message={emptyMessage ?? '표시할 연동 대상이 없습니다.'} />;
  }

  return (
    <div className={CONNECTED_FRAME}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className={idcStyles.table.approvalHeader}>
            <tr className="whitespace-nowrap">
              {HEADERS.map((h, i) => (
                <th key={i} className={cn(idcStyles.table.approvalHeaderCell, h.className)}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={idcStyles.table.body}>
            {rows.map((row) => {
              // 제외 행을 흐리게 하지 않는다 — 표시는 왼쪽 레일이 맡는다(verdictRail).
              return (
                <tr
                  key={row.resourceId}
                  className={cn(ROW_BASE, row.excluded ? ROW_EXCLUDED : ROW_TARGET)}
                >
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      verdictRailClass(row.excluded),
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!row.excluded}
                      aria-label="연동 대상 여부"
                      onChange={(e) => onToggle(row.resourceId, e.target.checked, e.currentTarget)}
                      className={cn(
                        'h-4 w-4 cursor-pointer rounded',
                        statusColors.pending.border,
                        primaryColors.text,
                        primaryColors.focusRing,
                      )}
                    />
                  </td>
                  <td className={idcStyles.table.approvalCell}>
                    <IdcKindBadge kind={row.kind} />
                  </td>
                  <td className={idcStyles.table.approvalCell}>
                    <IdcEndpointCell resource={row} />
                  </td>
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      'font-mono text-[12px]',
                      textColors.secondary,
                    )}
                  >
                    {row.port || <span className={textColors.tertiary}>—</span>}
                  </td>
                  <td className={idcStyles.table.approvalCell}>
                    <IdcDbTypeCell resource={row} />
                  </td>
                  {/* Blank, not an em-dash: a 대상 row can never carry a reason. */}
                  <td className={idcStyles.table.approvalCell}>
                    {row.excluded && row.exclusionReason ? (
                      <button
                        type="button"
                        aria-label="제외 사유 수정"
                        onClick={(e) => onReasonChipClick(row.resourceId, e.currentTarget)}
                        className="text-left"
                      >
                        <ReasonChipInline
                          reason={row.exclusionReason}
                          summary={clampReason(row.exclusionReason)}
                        />
                      </button>
                    ) : null}
                  </td>
                  <td className={idcStyles.table.approvalCell}>
                    <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <RowActionButton label="수정" onClick={() => onEdit(row.resourceId)}>
                        <EditIcon className="h-3.5 w-3.5" />
                      </RowActionButton>
                      <RowActionButton
                        label="삭제"
                        variant="delete"
                        onClick={() => onDelete(row.resourceId)}
                      >
                        <DeleteIcon className="h-3.5 w-3.5" />
                      </RowActionButton>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface RowActionButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'edit' | 'delete';
}

const RowActionButton = ({ label, onClick, children, variant = 'edit' }: RowActionButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={variant === 'delete' ? idcStyles.rowActionDelete : idcStyles.rowAction}
  >
    {children}
  </button>
);
