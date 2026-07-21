/**
 * IdcResourceTable — P3 IDC 연동 대상 리소스 + NLB 배정 (design-spec §3). App
 * res-tbl with the IDC identity columns (구분·Database Type·연동 대상·Port·Oracle
 * SID·Source IP) plus the admin-only NLB Index select, the assigned-NLB status
 * (OccBar + n/50 + Ftag), and a per-row 저장 button.
 *
 * resource_id is NEVER rendered — the row identity is 연동 대상 (IP/Host) + Port +
 * DB type + SID. Presentational: draft/save state is owned by the page; a select
 * change calls onSelect, and 저장 (shown only when dirty) calls onSave.
 */
'use client';

import type { ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { OccBar, FtagBadge } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import {
  NLB_CAPACITY,
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

const SELECT_BASE =
  'h-7 rounded-md border px-2.5 text-[12px] text-[var(--pl-text-strong)] bg-[var(--pl-bg-card)] cursor-pointer focus:outline-none focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)]';

/** Dropdown label is index-only — occupancy lives in the 배정 NLB 상태 cell. */
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
}: IdcResourceTableProps): ReactElement {
  const { appTable, tag, occ } = tqStyles;
  const occupancyByIndex = new Map(nlbTable.map((n) => [n.nlbIndex, n.occupiedListenerCount]));

  const kindTag = (kind: RequestResourceRow['idcKind']): string =>
    kind === 'HOST' ? 'Host' : 'IP';

  return (
    <div className={appTable.wrap}>
      <table className={appTable.root}>
        <thead className={appTable.thead}>
          <tr>
            <th className={`${appTable.th} w-[70px]`}>구분</th>
            <th className={`${appTable.th} w-[110px]`}>Database Type</th>
            <th className={appTable.th}>연동 대상</th>
            <th className={`${appTable.th} w-[64px]`}>Port</th>
            <th className={`${appTable.th} w-[100px]`}>Oracle SID</th>
            <th className={`${appTable.th} w-[150px]`}>Source IP</th>
            <th className={`${appTable.th} w-[170px]`}>NLB Index</th>
            <th className={`${appTable.th} w-[210px]`}>배정 NLB 상태</th>
            <th className={`${appTable.th} w-[170px]`} />
          </tr>
        </thead>
        <tbody className={appTable.body}>
          {rows.map((row, index) => {
            const connect = row.connectTargets.join(' · ') || '—';
            if (!row.selected) {
              return (
                <tr key={row.resourceId ?? index} className={cn(appTable.row, appTable.rowExcluded)}>
                  <td className={appTable.td}>
                    <span className={cn(tag.base, tag.gray)}>{kindTag(row.idcKind)}</span>
                  </td>
                  <td className={appTable.td}>
                    <span className={cn(tag.base, tag.grayStrong)}>{row.databaseType ?? '—'}</span>
                  </td>
                  <td className={`${appTable.td} ${appTable.tdMono}`}>{connect}</td>
                  <td className={`${appTable.td} ${appTable.tdMono}`}>{row.port ?? '—'}</td>
                  <td className={appTable.td}>
                    <span className="text-[var(--pl-text-weak)]">—</span>
                  </td>
                  <td className={appTable.td}>
                    <span className="text-[var(--pl-text-weak)]">—</span>
                  </td>
                  <td className={appTable.td}>
                    <span className={appTable.targetNo}>연동 대상 제외</span>
                  </td>
                  <td className={appTable.td} colSpan={2}>
                    <span className="text-[12px] font-normal text-[var(--pl-text-weak)]">
                      {row.exclusionReason ?? '—'}
                    </span>
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
              <tr key={row.resourceId ?? index} className={appTable.row}>
                <td className={appTable.td}>
                  <span className={cn(tag.base, tag.gray)}>{kindTag(row.idcKind)}</span>
                </td>
                <td className={appTable.td}>
                  <span className={cn(tag.base, tag.blue)}>{row.databaseType ?? '—'}</span>
                </td>
                <td className={`${appTable.td} ${appTable.tdMono}`}>{connect}</td>
                <td className={`${appTable.td} ${appTable.tdMono}`}>{row.port ?? '—'}</td>
                <td className={appTable.td}>
                  {row.oracleSid ? (
                    <span className={appTable.tdMono}>{row.oracleSid}</span>
                  ) : (
                    <span className="text-[var(--pl-text-weak)]">—</span>
                  )}
                </td>
                <td className={appTable.td}>
                  {row.sourceIps.length > 0 ? (
                    <span className={appTable.tdMono}>{row.sourceIps.join(' · ')}</span>
                  ) : (
                    <span className="text-[var(--pl-text-weak)]">—</span>
                  )}
                </td>
                <td className={appTable.td}>
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
                </td>
                <td className={appTable.td}>
                  {currentOcc != null ? (
                    <span className="inline-flex items-center gap-2">
                      <OccBar occupied={currentOcc} />
                      <span className={occ.num}>
                        {currentOcc}
                        <span className={occ.den}>/{NLB_CAPACITY}</span>
                      </span>
                      <FtagBadge occupied={currentOcc} />
                    </span>
                  ) : (
                    <span className="text-[var(--pl-text-weak)]">—</span>
                  )}
                </td>
                <td className={appTable.td}>
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
