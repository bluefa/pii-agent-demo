/**
 * IdcResourceTable — P3 IDC 연동 대상 리소스 + NLB 배정 (design-spec §3), rendered
 * rendered with the app-side IDC step-1 table itself — `idcStyles.table` chrome, the
 * shared ROW_* hover/lift tokens, ReasonChipInline — so the admin reads the request
 * the service owner submitted through the same design, plus the admin-only NLB Index
 * select (with the assigned NLB's load as a footnote under it) and a 저장 button.
 *
 * No 구분 column: IP-vs-Host is already legible from the value itself (an address or
 * a hostname), and a multi-IP endpoint says so by collapsing behind its own toggle.
 * No Oracle SID column either — it rides under Database Type, since only Oracle rows
 * carry one.
 *
 * resource_id is NEVER rendered — the row identity is 연동 대상 (IP/Host) + Port +
 * DB type + SID. Presentational: draft/save state is owned by the page; a select
 * change calls onSelect, and 저장 (shown only when dirty) calls onSave.
 */
'use client';

import type { ReactElement } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import {
  CELL_LIFT,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { NlbOccupancyNote } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcSourceIpCell,
} from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import {
  effectiveNlbIndex,
  isNlbDirty,
  nlbOptionDisabled,
  type NlbDraft,
} from '@/app/admin/pipelines/queue/requests/_logic';
import type { NlbTableRow, RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface IdcResourceTableProps {
  rows: RequestResourceRow[];
  nlbTable: NlbTableRow[];
  draft: NlbDraft;
  savingResourceId: string | null;
  /** Lock NLB editing (select + 저장) — the request is no longer PENDING, so a
   *  save would 409. */
  disabled?: boolean;
  onSelect: (row: RequestResourceRow, nlbIndex: number) => void;
  onSave: (row: RequestResourceRow) => void;
  /** Open the "현재 배정된 NLB" modal for this resource (read-only, always
   *  available — not gated by `disabled`). */
  onShowNlbInfo: (row: RequestResourceRow) => void;
  /** Squares the top corners when a toolbar is attached above (P3). */
  wrapClassName?: string;
}

const SELECT_BASE =
  'h-7 rounded-md border px-2.5 text-[12px] text-[var(--pl-text-strong)] bg-[var(--pl-bg-card)] cursor-pointer focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]';

/** Excluded rows REST one tier dimmer; the hover lift restores full contrast. */
const DIM = 'text-[#6B7280]';

/** Dropdown label is index-only — occupancy is the note under the select. */
function optionLabel(index: number): string {
  return `NLB #${index}`;
}

export function IdcResourceTable({
  rows,
  nlbTable,
  draft,
  savingResourceId,
  disabled = false,
  onSelect,
  onSave,
  onShowNlbInfo,
  wrapClassName,
}: IdcResourceTableProps): ReactElement {
  const { table } = idcStyles;
  const occupancyByIndex = new Map(nlbTable.map((n) => [n.nlbIndex, n.occupiedListenerCount]));

  return (
    <div className={cn(table.frame, wrapClassName)}>
      <table className="w-full">
        <thead className={table.header}>
          {/* Identity first, then its attributes, then the decision — the same reading
              order as the cloud table and step 1. An IDC row's identity is its host/IP,
              so 연동 대상 leads; Database Type carries the SID underneath. */}
          <tr>
            <th className={table.headerCell}>연동 대상</th>
            <th className={cn(table.headerCell, 'w-[172px]')}>Database Type</th>
            <th className={cn(table.headerCell, 'w-[80px]')}>Port</th>
            <th className={cn(table.headerCell, 'w-[144px]')}>Source IP</th>
            {/* One column, not two: the assigned NLB's load is a footnote on the choice,
                so it sits under the select instead of claiming its own 210px. */}
            <th className={cn(table.headerCell, 'w-[170px]')}>NLB Index</th>
            {/* The freed column. A row is either assignable or excluded, never both, so
                the two never collide — and the reason gets the width it needs. */}
            <th className={cn(table.headerCell, 'w-[220px]')}>제외 사유</th>
            <th className={cn(table.headerCell, 'w-[170px]')} />
          </tr>
        </thead>
        <tbody className={table.body}>
          {rows.map((row, index) => {
            const dbLabel = row.databaseType ? getDatabaseShortLabel(row.databaseType) : '';
            if (!row.selected) {
              return (
                <tr key={row.resourceId ?? index} className={cn(ROW_BASE, ROW_EXCLUDED)}>
                  <td className={table.cell}>
                    <IdcEndpointCell hosts={row.connectTargets} tone={DIM} />
                  </td>
                  <td className={table.cell}>
                    <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} tone={DIM} />
                  </td>
                  <td className={cn(table.cell, 'font-mono text-[12px]', DIM, CELL_LIFT)}>
                    {row.port}
                  </td>
                  {/* Excluded rows come from ExcludedResourceInfoDto, which carries no
                      source IPs — blank rather than asserting a missing value. */}
                  <td className={table.cell} />
                  <td className={cn(table.cell, 'whitespace-nowrap text-[12px]', DIM, CELL_LIFT)}>
                    제외
                  </td>
                  <td className={table.cell} colSpan={2}>
                    {row.exclusionReason && (
                      <ReasonChipInline
                        reason={row.exclusionReason}
                        summary={clampReason(row.exclusionReason)}
                      />
                    )}
                  </td>
                </tr>
              );
            }

            const current = effectiveNlbIndex(row, draft);
            const dirty = isNlbDirty(row, draft);
            const saving = savingResourceId != null && savingResourceId === row.resourceId;
            const currentOcc = current != null ? occupancyByIndex.get(current) : undefined;
            const canSave = row.resourceId != null && !disabled;

            return (
              <tr key={row.resourceId ?? index} className={cn(ROW_BASE, ROW_TARGET)}>
                <td className={table.cell}>
                  <IdcEndpointCell hosts={row.connectTargets} />
                </td>
                <td className={table.cell}>
                  <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} />
                </td>
                <td
                  className={cn(
                    table.cell,
                    'font-mono text-[12px]',
                    textColors.secondary,
                    CELL_LIFT,
                  )}
                >
                  {row.port}
                </td>
                <td className={table.cell}>
                  <IdcSourceIpCell sourceIps={row.sourceIps} />
                </td>
                <td className={table.cell}>
                  <span className="flex flex-col items-start gap-1">
                    <select
                      className={cn(
                        SELECT_BASE,
                        dirty
                          ? 'border-[var(--pl-primary)] shadow-[0_0_0_3px_var(--pl-primary-ring)]'
                          : 'border-[var(--pl-border-strong)]',
                      )}
                      aria-label="NLB Index"
                      value={current ?? ''}
                      disabled={!canSave || saving}
                      onChange={(event) => onSelect(row, Number(event.target.value))}
                    >
                      {current == null && <option value="">선택</option>}
                      {nlbTable.map((n) => (
                        <option
                          key={n.nlbIndex}
                          value={n.nlbIndex}
                          disabled={nlbOptionDisabled(n.occupiedListenerCount, n.nlbIndex, current)}
                        >
                          {optionLabel(n.nlbIndex)}
                        </option>
                      ))}
                    </select>
                    {currentOcc != null && <NlbOccupancyNote occupied={currentOcc} />}
                  </span>
                </td>
                {/* 제외 사유 — a target row has none, so the cell stays empty. */}
                <td className={table.cell} />
                <td className={table.cell}>
                  <span className="inline-flex items-center justify-end gap-1.5 w-full">
                    <PlButton variant="ghost" size="sm" onClick={() => onShowNlbInfo(row)}>
                      NLB 정보
                    </PlButton>
                    {dirty && !disabled && (
                      <PlButton variant="primary" size="sm" disabled={saving} onClick={() => onSave(row)}>
                        저장
                      </PlButton>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
