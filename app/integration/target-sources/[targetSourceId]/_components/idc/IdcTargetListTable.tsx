'use client';

import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { DeleteIcon, EditIcon } from '@/app/components/ui/icons';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  bgColors,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  tableStyles,
  textColors,
} from '@/lib/theme';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcKindBadge,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';

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
}

const HEADERS: ReadonlyArray<{ label: string; className?: string }> = [
  { label: '', className: 'w-[36px]' },
  { label: '구분', className: 'w-[100px]' },
  { label: '연동 대상', className: 'w-[220px]' },
  { label: 'Port', className: 'w-[70px]' },
  { label: 'Database Type' },
  { label: '제외 사유', className: 'w-[190px]' },
  { label: '연동 완료 여부', className: 'w-[110px]' },
  { label: '', className: 'w-[76px]' },
];

/**
 * Step 1 editable target table (v15 idcTargetTbody). Excluded rows dim and show
 * a clickable reason chip; row hover reveals 수정 / 삭제.
 */
export const IdcTargetListTable = ({
  rows,
  onToggle,
  onReasonChipClick,
  onEdit,
  onDelete,
}: IdcTargetListTableProps) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className={tableStyles.header}>
        <tr>
          {HEADERS.map((h, i) => (
            <th key={i} className={cn(tableStyles.headerCell, 'py-3', h.className)}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {rows.map((row) => {
          const dim = row.excluded ? 'opacity-50' : '';
          return (
            <tr key={row.resourceId} className={cn('group', tableStyles.row, row.excluded && bgColors.muted)}>
              <td className="px-6 py-4">
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
              <td className={cn('px-6 py-4', dim)}>
                <IdcKindBadge kind={row.kind} />
              </td>
              <td className={cn('px-6 py-4', dim)}>
                <IdcEndpointCell resource={row} />
              </td>
              <td className={cn('px-6 py-4 font-mono text-[12px]', textColors.secondary, dim)}>{row.port}</td>
              <td className={cn('px-6 py-4', dim)}>
                <IdcDbTypeCell resource={row} />
              </td>
              <td className="px-6 py-4">
                {row.excluded && row.exclusionReason ? (
                  <button
                    type="button"
                    aria-label="제외 사유 수정"
                    onClick={(e) => onReasonChipClick(row.resourceId, e.currentTarget)}
                    className="text-left"
                  >
                    <ReasonChipInline reason={row.exclusionReason} />
                  </button>
                ) : (
                  <span className={cn('text-[12px]', textColors.quaternary)}>—</span>
                )}
              </td>
              <td className={cn('px-6 py-4 text-[12.5px]', textColors.secondary, dim)}>{row.done}</td>
              <td className="px-6 py-4">
                <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <RowActionButton label="수정" onClick={() => onEdit(row.resourceId)}>
                    <EditIcon className="h-3.5 w-3.5" />
                  </RowActionButton>
                  <RowActionButton label="삭제" variant="delete" onClick={() => onDelete(row.resourceId)}>
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
);

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
