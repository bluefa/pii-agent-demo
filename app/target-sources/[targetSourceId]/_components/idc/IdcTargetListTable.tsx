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

// Checkbox → identity (구분 · 연동 대상 · Port) → attribute (Database Type) → decision (제외 사유)
// → row actions, the cloud step-1 order. The 연동 완료 여부 column is gone: every IDC adapter
// sets `done: null`, so it rendered an em-dash on every row of every list.
const HEADERS: ReadonlyArray<{ label: string; className?: string }> = [
  { label: '', className: 'w-[44px]' },
  { label: '구분', className: 'w-[100px]' },
  { label: '연동 대상', className: 'w-[220px]' },
  { label: 'Port', className: 'w-[70px]' },
  { label: 'Database Type' },
  { label: '제외 사유', className: 'w-[190px]' },
  { label: '', className: 'w-[76px]' },
];

/**
 * Step 1 editable target table. Same skin as the cloud step-1 candidate table: no frame of its
 * own (the toolbar above owns the rounded top, the pager below the rounded bottom), the 12px/600
 * approval header, and the row hover/focus lift that marks the row a user is working in.
 * Excluded rows dim and show a clickable reason chip; row hover reveals 수정 / 삭제.
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
              const dim = row.excluded ? 'opacity-50' : '';
              return (
                <tr
                  key={row.resourceId}
                  className={cn(ROW_BASE, row.excluded ? ROW_EXCLUDED : ROW_TARGET)}
                >
                  <td className={idcStyles.table.approvalCell}>
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
                  <td className={cn(idcStyles.table.approvalCell, dim)}>
                    <IdcKindBadge kind={row.kind} />
                  </td>
                  <td className={cn(idcStyles.table.approvalCell, dim)}>
                    <IdcEndpointCell resource={row} />
                  </td>
                  <td
                    className={cn(
                      idcStyles.table.approvalCell,
                      'font-mono text-[12px]',
                      textColors.secondary,
                      dim,
                    )}
                  >
                    {row.port}
                  </td>
                  <td className={cn(idcStyles.table.approvalCell, dim)}>
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
