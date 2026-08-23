/**
 * IdcResourceTable — P3 IDC 연동 대상 리소스 + NLB 배정 (design-spec §3), rendered
 * with the app-side IDC step-1 table itself — `idcStyles.table` chrome, the shared
 * ROW_* hover/lift tokens, ReasonChip — so the admin reads the request the
 * service owner submitted through the same design, plus the admin-only NLB column.
 *
 * Eight columns. Two of the original nine are gone for good, because a column each said
 * nothing the value beside it did not already say:
 *   - 구분 — IP-vs-Host is legible from the value itself (an address or a hostname).
 *   - Oracle SID — rides under Database Type; only Oracle rows carry one.
 * The 출발지 is not one of them: it moved next to NLB 배정 instead, since it is an
 * attribute of the assigned NLB, but it keeps a column of its own.
 *
 * 판정 열 쌍(요청 대상 여부 · 제외 사유)은 `showVerdict` 로 내려갈 수 있다 — 확정 정보처럼
 * 판정이 이미 끝난 목록에서는 두 열이 모든 행에서 같은 값이다.
 *
 * resource_id is NEVER rendered — the row identity is 접속 주소 (IP/Host) + Port +
 * DB type + SID. Presentational throughout: the NLB cell is a text button that hands
 * the row back to the page, which opens NlbAssignModal over it.
 */
'use client';

import type { ReactElement } from 'react';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { cn, idcStyles, textColors, verdictRail } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import { ReasonChip } from '@/app/admin/pipelines/queue/requests/_components/CloudResourceTable';
import { SourceIpHeader } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcSourceIpCell,
} from '@/app/admin/pipelines/queue/requests/_components/idcCells';
import type { SuspectMark } from '@/app/admin/pipelines/queue/requests/_duplicateAddress';
import { IDC_SOURCE_LABEL } from '@/lib/constants/idc';
import { idcAddressKind } from '@/app/lib/api/task-queue-requests';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

export interface IdcResourceTableProps {
  rows: RequestResourceRow[];
  /** Lock NLB editing — the request is no longer PENDING, so a save would 409.
   *  The assignment still reads, as plain text. */
  disabled?: boolean;
  /** Open NlbAssignModal for this resource. */
  onAssignNlb: (row: RequestResourceRow) => void;
  /**
   * Open ServiceAssignmentModal for this resource. Optional: the 승인 요청 상세 modal
   * reads a PAST request, while this lookup answers about the assignment as it stands
   * today — a different question. Omitting it drops the column rather than leaving it
   * empty down every row.
   */
  onShowServices?: (row: RequestResourceRow) => void;
  /**
   * 행 → '같은 DB 의심' 표시 (@see _duplicateAddress). 없으면 표시가 서지 않는다.
   *
   * 표시는 행 안에서 끝난다 — 그룹 머리글도, 행 재배치도 없다. 머리글은 열기만 하고 닫지
   * 않아서(다음 머리글이 나올 때까지 아무 행이나 그 아래 설 수 있다) 그룹의 범위를 관리자가
   * 배지를 세어 복원해야 했다. 짝의 주소를 행이 직접 들고 있으면 페이지가 갈려도, 정렬이
   * 바뀌어도 관계가 끊어지지 않는다.
   */
  suspectMarks?: ReadonlyMap<RequestResourceRow, SuspectMark>;
  /**
   * 요청의 판정 열 쌍(요청 대상 여부 · 제외 사유). 확정 정보처럼 **이미 판정이 끝난**
   * 목록에서는 두 열이 모든 행에서 같은 값이라(대상 · 빈칸) 통째로 내린다 — 열이 답하는
   * 질문이 그 화면에 없으면 열도 없다. 기본값은 요청 화면 그대로다.
   */
  showVerdict?: boolean;
  /**
   * NLB 점유표가 아직(또는 끝내) 없는 동안 배정 버튼을 이 이유(title)로 잠근다.
   * `disabled`(잠금: 버튼이 텍스트로 내려간다)와 달리 버튼은 버튼으로 남는다 —
   * 돌아올 상태다.
   */
  assignDisabledReason?: string;
  /** 사용 서비스 조회도 같은 문법 — 서비스별 배정 fetch 가 도착할 때까지. */
  servicesDisabledReason?: string;
}

/**
 * LIN-96 ledger floors (owner-approved 2026-08-23), corrections landed with the console
 * migration: 접속 주소 260 → 200, Database Type 170 → 172, 출발지 160 → 144, and the
 * previously elastic 제외 사유 gets its number (142). Full set Σ = 200+172+80+112+110+
 * 144+110+142 = 1070; the 확정 variant (no verdict pair, no services) Σ = 706.
 *
 * Flex pair = 접속 주소 + 제외 사유, so the sink is the reason column when it exists —
 * the same slack owner this table always had ("a sentence is the one cell that can spend
 * leftover width"), now as the console sink. Without the verdict pair the endpoint is the
 * single flex and stays its own sink (ConsoleTable's documented fallback).
 */
const ADMIN_IDC_FLEX_KEYS = ['endpoint', 'reason'] as const;

// A text button, not a control cluster: opening the assignment is one act, and the
// cell's job is to say what the row is assigned to right now. The underline stays on —
// hover-only left a column of plain blue text saying nothing about being clickable
// until the pointer was already on it. It rests at 40% and fills in on hover, so the
// affordance is legible without competing with the row's own values.
const NLB_BTN =
  'text-[14px] font-medium text-[var(--pl-primary)] tabular-nums cursor-pointer underline underline-offset-[3px] decoration-[var(--pl-primary)]/40 hover:decoration-[var(--pl-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)] rounded-sm';

// The same text button while its data is in flight — faint and unlined, so it reads
// "아직" rather than clickable or plain text; the button's title says why.
const NLB_BTN_HELD =
  'text-[14px] font-medium text-[var(--pl-text-faint)] tabular-nums cursor-not-allowed rounded-sm'; // design-exempt: disabled control — same faint tier as PlButton's disabled text

export function IdcResourceTable({
  rows,
  disabled = false,
  onAssignNlb,
  onShowServices,
  suspectMarks,
  showVerdict = true,
  assignDisabledReason,
  servicesDisabledReason,
}: IdcResourceTableProps): ReactElement {
  const { table } = idcStyles;

  // Cross-surface store: this component serves the queue request detail AND the ops
  // confirm tab (ConfirmedIdcTable), whose column sets differ only by the gated columns —
  // shared keys mean the identity columns hold one width across both.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: 'pii:colw:v1:admin-idc-resources',
    ephemeralKeys: ADMIN_IDC_FLEX_KEYS,
  });
  const columns: ConsoleTableColumn[] = [
    { key: 'endpoint', label: '접속 주소', width: 200, flex: true },
    { key: 'dbType', label: 'Database Type', width: 172 },
    { key: 'port', label: 'Port', width: 80 },
    ...(showVerdict ? [{ key: 'target', label: '요청 대상 여부', width: 112 }] : []),
    { key: 'nlb', label: 'NLB 배정', width: 110 },
    { key: 'src', label: IDC_SOURCE_LABEL, width: 144, head: <SourceIpHeader /> },
    ...(onShowServices ? [{ key: 'services', label: '사용 서비스', width: 110 }] : []),
    ...(showVerdict ? [{ key: 'reason', label: '제외 사유', width: 142, flex: true }] : []),
  ];

  return (
    // No frame of its own — the toolbar above owns the rounded top and the pager below
    // the bottom, exactly as step 1's list table does (CONNECTED_FRAME). The horizontal
    // scroll escape lives inside ConsoleTable's own wrapper.
    <div className={CONNECTED_FRAME}>
      <ConsoleTable columns={columns} resize={resize}>
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
            const mark = suspectMarks?.get(row);
            // 그룹의 천장과 바닥 — 한 그룹의 행들은 붙어 서 있으므로(groupSuspectRows) 앞뒤
            // 행의 이름만 보면 된다. 페이지가 그룹을 자르면 남은 조각이 자기 안에서 다시
            // 열리고 닫힌다: 여기 없는 구성원까지 선을 뻗으면 없는 행을 가리키게 된다.
            const label = mark?.label;
            const opensGroup = label != null && label !== suspectMarks?.get(rows[index - 1])?.label;
            const closesGroup = label != null && label !== suspectMarks?.get(rows[index + 1])?.label;
            // 혼자 남은 조각에는 선을 긋지 않는다 — 이을 상대가 이 페이지에 없는데 엘보만
            // 그리면 아무것도 가리키지 않는 6px 토막이 된다.
            const connector =
              label == null || (opensGroup && closesGroup)
                ? undefined
                : cn(
                    idcStyles.checkGroup.cell,
                    opensGroup && idcStyles.checkGroup.first,
                    closesGroup && idcStyles.checkGroup.last,
                  );
            if (!row.selected) {
              return (
                <tr key={rowKey} className={cn(ROW_BASE, ROW_EXCLUDED)}>
                  {/* 제외는 자홍 레일을 달지 않는다 (오너, 2026-08-17) — 이 표에서 제외는
                      '제외' pill 과 제외 사유가 이미 말하고, 왼쪽 레일 자리는 확인 필요
                      그룹의 선이 쓴다. 연동 불가만 레일을 유지한다: 그건 이 요청 안에서
                      되돌릴 수 없는 판정이라 제외와 같은 층이 아니다. 다른 화면의
                      `verdictRail.excluded` 는 그대로다. */}
                  <td
                    className={cn(
                      table.approvalCell,
                      table.consoleCell,
                      row.integrationCategory === 'INSTALL_INELIGIBLE' && verdictRail.ineligible,
                    )}
                  >
                    <IdcEndpointCell
                      hosts={row.connectTargets}
                      kind={idcAddressKind(row)}
                      tone={textColors.secondary}
                      maxWidthClass="max-w-full"
                    />
                  </td>
                  <td className={cn(table.approvalCell, table.consoleCell)}>
                    <IdcDbTypeCell
                      label={dbLabel}
                      oracleSid={row.oracleSid}
                      tone={textColors.secondary}
                      sidMaxWidthClass="max-w-full"
                    />
                  </td>
                  {/* 0 is the adapter's "no port in the payload" value, not a port — step
                      1's own guard, so the two tables answer a missing port the same way. */}
                  <td
                    className={cn(
                      table.approvalCell,
                      'font-mono text-[14px]',
                      textColors.secondary,
                      CELL_LIFT,
                    )}
                  >
                    {row.port || <span className={textColors.tertiary}>—</span>}
                  </td>
                  {/* The pill step 1 uses, not a text label: the verdict is the same fact
                      on both surfaces, and INSTALL_INELIGIBLE must not read as a revisable
                      제외 — TargetPill draws that line. */}
                  {showVerdict && (
                    <td className={table.approvalCell}>
                      <TargetPill
                        excluded
                        ineligible={row.integrationCategory === 'INSTALL_INELIGIBLE'}
                      />
                    </td>
                  )}
                  {/* An excluded row is never assignable, and carries no service fan-out.
                      It also comes from ExcludedResourceInfoDto, which carries no source
                      IPs — blank rather than asserting a missing value. */}
                  <td className={table.approvalCell} />
                  <td className={table.approvalCell} />
                  {onShowServices && <td className={table.approvalCell} />}
                  {showVerdict && (
                    <td className={cn(table.approvalCell, table.consoleCell, 'text-sm')}>
                      <ReasonChip row={row} />
                    </td>
                  )}
                </tr>
              );
            }


            return (
              <tr key={rowKey} className={cn(ROW_BASE, ROW_TARGET)}>
                <td className={cn(table.approvalCell, table.consoleCell, connector)}>
                  <IdcEndpointCell
                    hosts={row.connectTargets}
                    kind={idcAddressKind(row)}
                    suspect={mark}
                    maxWidthClass="max-w-full"
                  />
                </td>
                <td className={cn(table.approvalCell, table.consoleCell)}>
                  <IdcDbTypeCell label={dbLabel} oracleSid={row.oracleSid} sidMaxWidthClass="max-w-full" />
                </td>
                <td
                  className={cn(
                    table.approvalCell,
                    'font-mono text-[14px]',
                    textColors.secondary,
                    CELL_LIFT,
                  )}
                >
                  {row.port || <span className={textColors.tertiary}>—</span>}
                </td>
                {showVerdict && (
                  <td className={table.approvalCell}>
                    <TargetPill excluded={false} />
                  </td>
                )}
                <td className={table.approvalCell}>
                  {/* The assignment itself is the control — a text button naming the
                      current index, or 배정하기 when there is none. A locked request still
                      reads its assignment, as plain text. */}
                  {disabled || row.resourceId == null ? (
                    row.nlbIndex != null && (
                      <span className={cn('text-[14px] tabular-nums', textColors.secondary, CELL_LIFT)}>
                        NLB #{row.nlbIndex}
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      className={assignDisabledReason != null ? NLB_BTN_HELD : NLB_BTN}
                      disabled={assignDisabledReason != null}
                      title={assignDisabledReason}
                      onClick={() => onAssignNlb(row)}
                    >
                      {row.nlbIndex != null ? `NLB #${row.nlbIndex}` : '배정하기'}
                    </button>
                  )}
                </td>
                {/* Right of the assignment that produces it. */}
                <td className={cn(table.approvalCell, table.consoleCell)}>
                  <IdcSourceIpCell sourceIps={row.sourceIps} maxWidthClass="max-w-full" />
                </td>
                {onShowServices && (
                  <td className={table.approvalCell}>
                    {/* Same text-button grammar as the assignment beside it — one column,
                        one way in. A row with no resource_id has nothing to look up. */}
                    {row.resourceId != null && (
                      <button
                        type="button"
                        className={servicesDisabledReason != null ? NLB_BTN_HELD : NLB_BTN}
                        disabled={servicesDisabledReason != null}
                        title={servicesDisabledReason}
                        onClick={() => onShowServices(row)}
                      >
                        조회
                      </button>
                    )}
                  </td>
                )}
                {/* 제외 사유 — a target row has none. */}
                {showVerdict && <td className={table.approvalCell} />}
              </tr>
            );
          })}
        </tbody>
      </ConsoleTable>
    </div>
  );
}
