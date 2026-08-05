/**
 * IdcResourceTable — P3 IDC 연동 대상 리소스 + NLB 배정 (design-spec §3), rendered
 * with the app-side IDC step-1 table itself — `idcStyles.table` chrome, the shared
 * ROW_* hover/lift tokens, ReasonChipInline — so the admin reads the request the
 * service owner submitted through the same design, plus the admin-only NLB column.
 *
 * Eight columns. Two of the original nine are gone for good, because a column each said
 * nothing the value beside it did not already say:
 *   - 구분 — IP-vs-Host is legible from the value itself (an address or a hostname).
 *   - Oracle SID — rides under Database Type; only Oracle rows carry one.
 * Source IP is not one of them: it moved next to NLB 배정 instead, since it is an
 * attribute of the assigned NLB, but it keeps a column of its own.
 *
 * resource_id is NEVER rendered — the row identity is 접속 주소 (IP/Host) + Port +
 * DB type + SID. Presentational throughout: the NLB cell is a text button that hands
 * the row back to the page, which opens NlbAssignModal over it.
 */
'use client';

import type { ReactElement } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  DIM_TEXT,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { SourceIpHeader } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcSourceIpCell,
} from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import { idcAddressKind } from '@/app/lib/api/task-queue-requests';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface IdcResourceTableProps {
  rows: RequestResourceRow[];
  /** Lock NLB editing — the request is no longer PENDING, so a save would 409.
   *  The assignment still reads, as plain text. */
  disabled?: boolean;
  /** Open NlbAssignModal for this resource. */
  onAssignNlb: (row: RequestResourceRow) => void;
  /** Open ServiceAssignmentModal for this resource. */
  onShowServices: (row: RequestResourceRow) => void;
}

// A text button, not a control cluster: opening the assignment is one act, and the
// cell's job is to say what the row is assigned to right now. The underline stays on —
// hover-only left a column of plain blue text saying nothing about being clickable
// until the pointer was already on it. It rests at 40% and fills in on hover, so the
// affordance is legible without competing with the row's own values.
const NLB_BTN =
  'text-[13px] font-medium text-[var(--pl-primary)] tabular-nums cursor-pointer underline underline-offset-[3px] decoration-[var(--pl-primary)]/40 hover:decoration-[var(--pl-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)] rounded-sm';

export function IdcResourceTable({
  rows,
  disabled = false,
  onAssignNlb,
  onShowServices,
}: IdcResourceTableProps): ReactElement {
  const { table } = idcStyles;

  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME).
    <div className={CONNECTED_FRAME}>
      <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className={table.approvalHeaderChrome}>
          {/* Identity first, then its attributes, then the decision — the same reading
              order as the cloud table and step 1. An IDC row's identity is its host/IP,
              so 접속 주소 leads; Database Type carries the SID underneath. */}
          <tr>
            {/* Each column is sized to its longest real value; only 제외 사유 is elastic,
                because a sentence is the one cell that can spend leftover width. The page
                is layout.contentFluid (no max-width), so the table gets viewport − 328px:
                these seven fixed columns total 1002, leaving ~230px for the reason at
                1512 and ~590px at 1920 (the section carries no card, so there is no
                px-6 to subtract). 접속 주소 caps its text at 220px — a long FQDN
                truncates to its tip either way, and the tip carries the full value. */}
            <th className={cn(table.approvalHeaderCell, 'w-[260px]')}>접속 주소</th>
            <th className={cn(table.approvalHeaderCell, 'w-[170px]')}>Database Type</th>
            {/* Beside the engine it belongs to: which port a DB answers on is an
                attribute of the engine, not of the address. */}
            <th className={cn(table.approvalHeaderCell, 'w-[80px]')}>Port</th>
            {/* Back as a real column: with the row's other cells sized to their content
                there was width to spare, and the verdict is the one thing the admin is
                actually deciding — worth a header rather than an sr-only aside. */}
            {/* 112 is step 1's own width for this column — the pill, not a text label,
                is what has to fit. */}
            <th className={cn(table.approvalHeaderCell, 'w-[112px] whitespace-nowrap')}>요청 대상 여부</th>
            {/* NLB 배정 and 제외 사유 stay separate: they never co-occur in a row, but
                they answer different questions and one shared header could only name
                both. 110px is what a text button needs — the select it replaced took
                290. */}
            <th className={cn(table.approvalHeaderCell, 'w-[110px]')}>NLB 배정</th>
            {/* Adjacent to the assignment, because a source IP is an attribute of the NLB
                the target was assigned to — reading NLB #3 and the IPs it answers from
                should not cross the table. Stacking them in one cell read worse:
                two values of different kinds in one column lost the scan down either one.
                Step 1's own header, imported rather than restated: the column needs the
                "방화벽 등록 필요" note here too — the admin approving the request is the
                one who has to know the rule the service owner was shown. */}
            <th className={cn(table.approvalHeaderCell, 'w-[160px]')}>
              <SourceIpHeader />
            </th>
            {/* The same 연동 대상 can be consumed by 20–30 services, each on its own NLB
                — a fan-out no cell can hold. The column carries the way in, not the list. */}
            <th className={cn(table.approvalHeaderCell, 'w-[110px]')}>서비스별 배정</th>
            <th className={table.approvalHeaderCell}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={table.body}>
          {rows.map((row, index) => {
            // Identity first: the list filters and pages, so a positional key would let
            // per-row tooltip and copy state follow a slot rather than a resource.
            // resource_id is optional in the contract, and the endpoint alone is not
            // unique — one host can carry MySQL:3306 and Oracle:1521 — so the fallback
            // spells out the whole identity, with the index as the last resort for a row
            // that has none (an excluded row carries no connect targets).
            const rowKey =
              row.resourceId ??
              `${row.connectTargets.join('|')}|${row.port ?? ''}|${row.databaseType ?? ''}|${index}`;
            const dbLabel = row.databaseType ? getDatabaseShortLabel(row.databaseType) : '';
            if (!row.selected) {
              return (
                <tr key={rowKey} className={cn(ROW_BASE, ROW_EXCLUDED)}>
                  <td className={table.approvalCell}>
                    <IdcEndpointCell
                      hosts={row.connectTargets}
                      kind={idcAddressKind(row)}
                      dimmed
                      tone={DIM_TEXT}
                    />
                  </td>
                  <td className={table.approvalCell}>
                    <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} tone={DIM_TEXT} />
                  </td>
                  {/* 0 is the adapter's "no port in the payload" value, not a port — step
                      1's own guard, so the two tables answer a missing port the same way. */}
                  <td className={cn(table.approvalCell, 'font-mono text-[12px]', DIM_TEXT, CELL_LIFT)}>
                    {row.port || <span className={textColors.tertiary}>—</span>}
                  </td>
                  {/* The pill step 1 uses, not a text label: the verdict is the same fact
                      on both surfaces, and INSTALL_INELIGIBLE must not read as a revisable
                      제외 — TargetPill draws that line. */}
                  <td className={table.approvalCell}>
                    <TargetPill
                      excluded
                      ineligible={row.integrationCategory === 'INSTALL_INELIGIBLE'}
                    />
                  </td>
                  {/* An excluded row is never assignable, and carries no service fan-out.
                      It also comes from ExcludedResourceInfoDto, which carries no source
                      IPs — blank rather than asserting a missing value. */}
                  <td className={table.approvalCell} />
                  <td className={table.approvalCell} />
                  <td className={table.approvalCell} />
                  <td className={cn(table.approvalCell, 'text-sm')}>
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


            return (
              <tr key={rowKey} className={cn(ROW_BASE, ROW_TARGET)}>
                <td className={table.approvalCell}>
                  <IdcEndpointCell hosts={row.connectTargets} kind={idcAddressKind(row)} />
                </td>
                <td className={table.approvalCell}>
                  <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} />
                </td>
                <td
                  className={cn(
                    table.approvalCell,
                    'font-mono text-[12px]',
                    textColors.secondary,
                    CELL_LIFT,
                  )}
                >
                  {row.port || <span className={textColors.tertiary}>—</span>}
                </td>
                <td className={table.approvalCell}>
                  <TargetPill excluded={false} />
                </td>
                <td className={table.approvalCell}>
                  {/* The assignment itself is the control — a text button naming the
                      current index, or 배정하기 when there is none. A locked request still
                      reads its assignment, as plain text. */}
                  {disabled || row.resourceId == null ? (
                    row.nlbIndex != null && (
                      <span className={cn('text-[13px] tabular-nums', textColors.secondary, CELL_LIFT)}>
                        NLB #{row.nlbIndex}
                      </span>
                    )
                  ) : (
                    <button type="button" className={NLB_BTN} onClick={() => onAssignNlb(row)}>
                      {row.nlbIndex != null ? `NLB #${row.nlbIndex}` : '배정하기'}
                    </button>
                  )}
                </td>
                {/* Right of the assignment that produces it. */}
                <td className={table.approvalCell}>
                  <IdcSourceIpCell sourceIps={row.sourceIps} />
                </td>
                <td className={table.approvalCell}>
                  {/* Same text-button grammar as the assignment beside it — one column,
                      one way in. A row with no resource_id has nothing to look up. */}
                  {row.resourceId != null && (
                    <button type="button" className={NLB_BTN} onClick={() => onShowServices(row)}>
                      조회
                    </button>
                  )}
                </td>
                {/* 제외 사유 — a target row has none. */}
                <td className={table.approvalCell} />
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
