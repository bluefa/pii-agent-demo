/**
 * IdcResourceTable — P3 IDC 연동 대상 리소스 + NLB 배정 (design-spec §3), rendered
 * with the app-side IDC step-1 table itself — `idcStyles.table` chrome, the shared
 * ROW_* hover/lift tokens, ReasonChipInline — so the admin reads the request the
 * service owner submitted through the same design, plus the admin-only NLB column
 * (select carrying each index's load, its detail affordance, and its 저장).
 *
 * Six columns. Two of the original nine are gone for good, because a column each
 * said nothing the value beside it did not already say:
 *   - 구분 — IP-vs-Host is legible from the value itself (an address or a hostname).
 *   - Oracle SID — rides under Database Type; only Oracle rows carry one.
 *   - Port — rides with the host as `host:port`; a target IS an endpoint.
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
  CONNECTED_FRAME,
  DIM_TEXT,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { SourceIpHeader } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcSourceIpCell,
} from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import {
  NLB_CAPACITY,
  NLB_WARN_THRESHOLD,
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
}

// `min-w-0 flex-1` so the control fills its (elastic) column instead of leaving a
// gutter to its right — the option labels carry occupancy, which is what that width
// is for.
const SELECT_BASE =
  'h-7 min-w-0 flex-1 rounded-md border px-2.5 text-[12px] text-[var(--pl-text-strong)] bg-[var(--pl-bg-card)] cursor-pointer focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]';

const NLB_INFO_BTN =
  'inline-grid h-7 w-7 flex-none place-items-center rounded-md text-[var(--pl-text-faint)] transition-colors hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)]';

/**
 * Occupancy rides IN the option label. It used to appear as a note UNDER the select —
 * i.e. only after the admin had already committed to an index — so the choice was made
 * blind and then annotated. The tier is spelled out rather than colored: a disabled
 * option that only looked different gave no reason for being unpickable.
 */
function optionLabel(row: NlbTableRow): string {
  const { nlbIndex, occupiedListenerCount: occupied } = row;
  // Same three labels the NLB 리스너 현황 badge uses — "한도 초과" would also be wrong
  // at exactly 50, which is the limit rather than past it.
  const tier =
    occupied >= NLB_CAPACITY ? ' Hard Limit' : occupied >= NLB_WARN_THRESHOLD ? ' 주의' : '';
  return `NLB #${nlbIndex} · ${occupied}/${NLB_CAPACITY}${tier}`;
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
}: IdcResourceTableProps): ReactElement {
  const { table } = idcStyles;

  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME).
    <div className={CONNECTED_FRAME}>
      <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className={table.approvalHeader}>
          {/* Identity first, then its attributes, then the decision — the same reading
              order as the cloud table and step 1. An IDC row's identity is its host/IP,
              so 연동 대상 leads; Database Type carries the SID underneath. */}
          <tr>
            {/* Each column is sized to its longest real value; only 제외 사유 is elastic,
                because a sentence is the one cell that can spend leftover width. The page
                is layout.contentFluid (no max-width), so the table gets viewport − 328px:
                these five fixed columns total 988, leaving ~196px for the reason at 1512
                and ~600px at 1920. 연동 대상 caps its text at 220px — a long FQDN
                truncates to its tip either way, and the tip carries the full value. */}
            <th className={cn(table.approvalHeaderCell, 'w-[280px]')}>연동 대상</th>
            <th className={cn(table.approvalHeaderCell, 'w-[170px]')}>Database Type</th>
            {/* Step 1's own header, imported rather than restated: the column needs the
                "방화벽 등록 필요" note here too — the admin approving the request is the
                one who has to know the rule the service owner was shown. */}
            <th className={cn(table.approvalHeaderCell, 'w-[160px]')}>
              <SourceIpHeader />
            </th>
            {/* A row is either assignable or excluded, never both — so one column holds
                whichever applies: the NLB choice (+ detail, + save) or the reason it was
                left out. Two mutually exclusive columns meant every row rendered one of
                them empty. */}
            {/* Back as a real column: with the row's other cells sized to their content
                there was width to spare, and the verdict is the one thing the admin is
                actually deciding — worth a header rather than an sr-only aside. */}
            <th className={cn(table.approvalHeaderCell, 'w-[88px] whitespace-nowrap')}>요청 대상 여부</th>
            {/* NLB 배정 and 제외 사유 are separate columns again: they never co-occur in a
                row, but they answer different questions, and one shared header could only
                name both. The select fills its column, so the empty half of each row is
                just white space, not a gap in the grid. */}
            <th className={cn(table.approvalHeaderCell, 'w-[290px]')}>NLB 배정</th>
            <th className={table.approvalHeaderCell}>제외 사유</th>
          </tr>
        </thead>
        <tbody className={table.body}>
          {rows.map((row) => {
            // Keyed by identity, never by index: the list filters and pages, and
            // IdcEndpointCell owns per-row expand state that must not follow a slot.
            const rowKey = row.resourceId ?? row.connectTargets.join('|');
            const dbLabel = row.databaseType ? getDatabaseShortLabel(row.databaseType) : '';
            if (!row.selected) {
              return (
                <tr key={rowKey} className={cn(ROW_BASE, ROW_EXCLUDED)}>
                  <td className={table.approvalCell}>
                    <IdcEndpointCell hosts={row.connectTargets} port={row.port} tone={DIM_TEXT} />
                  </td>
                  <td className={table.approvalCell}>
                    <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} tone={DIM_TEXT} />
                  </td>
                  {/* Excluded rows come from ExcludedResourceInfoDto, which carries no
                      source IPs — blank rather than asserting a missing value. */}
                  <td className={table.approvalCell} />
                  <td className={cn(table.approvalCell, 'whitespace-nowrap text-[12px]', DIM_TEXT, CELL_LIFT)}>
                    제외
                  </td>
                  {/* An excluded row is never assignable. */}
                  <td className={table.approvalCell} />
                  <td className={table.approvalCell}>
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
            const canSave = row.resourceId != null && !disabled;

            return (
              <tr key={rowKey} className={cn(ROW_BASE, ROW_TARGET)}>
                <td className={table.approvalCell}>
                  <IdcEndpointCell hosts={row.connectTargets} port={row.port} />
                </td>
                <td className={table.approvalCell}>
                  <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} />
                </td>
                <td className={table.approvalCell}>
                  <IdcSourceIpCell sourceIps={row.sourceIps} />
                </td>
                <td
                  className={cn(
                    table.approvalCell,
                    'whitespace-nowrap text-[12px]',
                    textColors.secondary,
                    CELL_LIFT,
                  )}
                >
                  대상
                </td>
                <td className={table.approvalCell}>
                  <span className="flex items-center gap-1.5">
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
                          {optionLabel(n)}
                        </option>
                      ))}
                    </select>
                    {/* Sits beside the value it explains. Icon-only, so it carries its own
                        name (§aria-labels) and a 28px box around the glyph. 18px matches
                        the header ⓘ next to it (17px) — at 14 it read as a stray mark
                        rather than the same affordance. */}
                    <button
                      type="button"
                      onClick={() => onShowNlbInfo(row)}
                      aria-label="배정된 NLB 정보"
                      title="배정된 NLB 정보"
                      className={NLB_INFO_BTN}
                    >
                      <Icon name="info" size={18} />
                    </button>
                    {/* 저장 keeps a reserved slot: appearing/disappearing used to shift the
                        row's layout the moment an admin touched the select. */}
                    <span className="inline-flex w-[46px] flex-none justify-start">
                      {dirty && !disabled && (
                        <PlButton
                          variant="primary"
                          size="sm"
                          disabled={saving}
                          onClick={() => onSave(row)}
                        >
                          저장
                        </PlButton>
                      )}
                    </span>
                  </span>
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
