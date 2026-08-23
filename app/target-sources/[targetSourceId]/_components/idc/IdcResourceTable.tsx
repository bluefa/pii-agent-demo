'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { ConsoleTable, type ConsoleTableColumn } from '@/app/components/ui/ConsoleTable';
import { useColumnResize } from '@/app/components/ui/useColumnResize';
import { cn, idcStyles, textColors, verdictRailClass } from '@/lib/theme';
import { IDC_SOURCE_IP_TOOLTIP, IDC_SOURCE_LABEL } from '@/lib/constants/idc';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  IdcDbTypeCell,
  IdcEndpointWithKindCell,
  IdcSourceIpCell,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';
import { TcStatusTag } from '@/app/components/features/process-status/TcStatusTag';
import type { UnitTcStatus } from '@/lib/test-connection-summary';
import {
  CELL_LIFT,
  CONNECTED_FRAME,
  ROW_BASE,
  ROW_EXCLUDED,
  ROW_TARGET,
  TargetPill,
  clampReason,
} from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import type { LogicalDbCountMap } from '@/app/target-sources/[targetSourceId]/_components/confirmed/logical-db-summaries';

/**
 * Column set per step. Order matters for `src` alone: last in the list puts 출발지 at the right
 * edge (steps 5·6·7), anywhere else keeps it next to the identity columns (step 3). Every other
 * column has one fixed place.
 *
 * `fw`/`health` are gone (owner deletion order, 2026-08-23, with the LIN-96 ledger approval):
 * both were fully typed and rendered but had zero callers — the 접근 허용 answer lives in
 * IdcFirewallModal, and per-resource health has no API source. Restore from git history if a
 * caller ever materializes.
 */
export type IdcTableCol =
  | 'src'
  | 'excl'
  /** Step 5 only — the DB Credential, edited in place the way the cloud step 5 edits it. */
  | 'cred'
  /** Step 5 only — 연결 상태: 최근 실행이 이 리소스에 대해 보고한 판정(클라우드 step 5 와 같은 칸). */
  | 'conn'
  /** Steps 5·6·7 — the Step 5 logical-DB result as two count columns (연동 논리 DB / 연동 제외). */
  | 'logicalro';

interface IdcResourceTableProps {
  resources: readonly IdcResourceView[];
  /** Column set per step (v15 `data-idc-cols`). `excl` also includes excluded rows. */
  cols: readonly IdcTableCol[];
  emptyMessage?: string;
  /** Steps 5·6·7: open the per-resource logical-DB modal. */
  onLogicalOpen?: (resource: IdcResourceView) => void;
  /** `cred` column only — the step's live credential map (local edits included). */
  credentials?: Readonly<Record<string, string>>;
  /** `cred` column only: open the per-resource credential picker. */
  onCredentialOpen?: (resource: IdcResourceView) => void;
  /**
   * `logicalro` column only — per-resource Step 5 counts from the test-connection
   * latest-results. A resource absent from the map renders "—", never a fabricated 0.
   */
  logicalDbCounts?: LogicalDbCountMap;
  /**
   * `conn` column only — 최근 실행의 리소스별 판정(`foldAgentStatuses`). **행의
   * `connection` 이 아니라 이 맵을 읽는다**: 그 필드는 무보고를 PENDING 으로 접어서
   * "아직 아무 결과도 없다" 와 "agent 가 대기라고 보고했다" 를 같은 픽셀로 만든다.
   * 맵에 없는 리소스는 무보고다.
   */
  connectionStatusByResource?: ReadonlyMap<string, UnitTcStatus>;
  /** `conn` column only — 첫 폴링 응답 전. 판정 대신 스켈레톤을 그린다. */
  connectionLoading?: boolean;
  /**
   * `conn` column only — 실행 회차가 하나라도 있는가. 맵이 비었다는 사실만으로는 가를 수
   * 없다: 한 건도 보고하지 못하고 끝난 실행도 빈 맵을 남긴다(mock fixture 2108).
   * `null` 은 조회 자체를 못 했다는 뜻이라 '없다' 와 다르다 — TcStatusTag 참고.
   * 기본값이 `false` 인 건 이 열이 opt-in 이라서다 — 열을 세우는 쪽이 답을 같이 준다.
   */
  connectionHasRun?: boolean | null;
  /**
   * Borderless frame that joins under a toolbar (steps 2·3·5·6·7): pagination moves to the
   * caller, which owns the toolbar's filter state — same contract as WaitingApprovalTable's
   * own `connected`. Off = the paged dialog frame (완료 승인 모달), which keeps the internal
   * pager. Both frames now hold the SAME console table; only the chrome around it differs.
   */
  connected?: boolean;
}

const [TIP_TITLE, ...TIP_REST] = IDC_SOURCE_IP_TOOLTIP.split('\n');

/** Exported so the admin's P3 request table heads the column identically — the
 *  "접근 허용 필요" note answers the same question on both surfaces. */
export const SourceIpHeader = () => (
  <span className="inline-flex items-center gap-1">
    {IDC_SOURCE_LABEL}
    <InfoTooltip
      // Light `value` box, the same one the 접속 주소 cell tooltip uses — one table should not
      // answer a hover with a dark popover in one column and a light one in another.
      variant="value"
      // 17px — the table-header (?) size set by CSP step 1 (CandidateResourceTable). The
      // component default is 13, which reads as a different control next to the same header.
      iconSize={17}
      content={
        <div className="space-y-1">
          <div className="font-bold">{TIP_TITLE}</div>
          <div>{TIP_REST.join(' ')}</div>
        </div>
      }
    />
  </span>
);

/**
 * Column floors — the LIN-96 ledger, verbatim (owner-approved 2026-08-23). Per-combination
 * sums, so a width change here is checked against every surface at once:
 *
 *   [logicalro]                 승인 모달   200+80+172+118+96          =  666
 *   [excl]                      step 2     200+80+172+112+142         =  706
 *   [src,excl]                  step 3     200+80+172+144+112+142     =  850
 *   [cred,conn,logicalro,src]   step 5     200+80+172+180+104+118+96+144 = 1094
 *   [logicalro,src]             steps 6·7  200+80+172+118+96+144      =  810
 *
 * Ledger corrections landed with the migration: 연동 논리 DB 120 → 118, and the two
 * previously UN-declared columns get numbers (제외 사유 142 · 연동 제외 96) — under
 * table-fixed an undeclared column is not "auto slack", it is a bug.
 *
 * ⚠️ Step 5's 1094 exceeds the panel at common widths — ConsoleTable's own wrapper is
 * the overflow-x-auto escape hatch the legacy frame never had (ledger ⚠️⁴). The 승인
 * 모달 combo (666) fits its 712px pane with ~46px of slack for the flex column.
 */
const IDC_COLUMN_WIDTHS = {
  endpoint: 200,
  port: 80,
  dbType: 172,
  src: 144,
  target: 112,
  reason: 142,
  cred: 180,
  conn: 104,
  logicalDb: 118,
  logicalExcl: 96,
} as const;

/** The flex keys — session-only widths, like every console surface's flex pair. */
const IDC_FLEX_KEYS = ['endpoint'] as const;

/**
 * SINGLE flex, deliberately (ledger footnote ³, decided against the live screen): 접속 주소
 * is the only column whose values run arbitrarily long on every row — hosts and FQDNs.
 * Database Type is the runner-up but its value is an engine enum with an optional SID line;
 * making it the sink would pour slack into a column that is short on most rows (§9(b):
 * the sink's pixels must do value work). The cost of single-flex is documented in
 * ConsoleTable: the endpoint's own handle soft-floors at the fill width instead of handing
 * the sink over — Cloudscape's behaviour, acceptable here.
 */
const idcColumns = (
  has: (c: IdcTableCol) => boolean,
  srcAtEnd: boolean,
): ConsoleTableColumn[] => {
  const src: ConsoleTableColumn = {
    key: 'src',
    label: IDC_SOURCE_LABEL,
    width: IDC_COLUMN_WIDTHS.src,
    head: <SourceIpHeader />,
  };
  return [
    { key: 'endpoint', label: '접속 주소', width: IDC_COLUMN_WIDTHS.endpoint, flex: true },
    { key: 'port', label: 'Port', width: IDC_COLUMN_WIDTHS.port },
    { key: 'dbType', label: 'Database Type', width: IDC_COLUMN_WIDTHS.dbType },
    ...(has('src') && !srcAtEnd ? [src] : []),
    ...(has('excl')
      ? [
          { key: 'target', label: '요청 대상 여부', width: IDC_COLUMN_WIDTHS.target },
          { key: 'reason', label: '제외 사유', width: IDC_COLUMN_WIDTHS.reason },
        ]
      : []),
    ...(has('cred') ? [{ key: 'cred', label: 'Credential', width: IDC_COLUMN_WIDTHS.cred }] : []),
    ...(has('conn') ? [{ key: 'conn', label: '연결 상태', width: IDC_COLUMN_WIDTHS.conn }] : []),
    ...(has('logicalro')
      ? [
          { key: 'logicalDb', label: '연동 논리 DB', width: IDC_COLUMN_WIDTHS.logicalDb },
          { key: 'logicalExcl', label: '연동 제외', width: IDC_COLUMN_WIDTHS.logicalExcl },
        ]
      : []),
    ...(has('src') && srcAtEnd ? [src] : []),
  ];
};

/** Value cell: approval rhythm + the console covenant (overflow cuts on the boundary). */
const VALUE_CELL = cn(idcStyles.table.approvalCell, idcStyles.table.consoleCell);

export const IdcResourceTable = ({
  resources,
  cols,
  emptyMessage,
  onLogicalOpen,
  credentials,
  onCredentialOpen,
  logicalDbCounts,
  connectionStatusByResource,
  connectionLoading = false,
  connectionHasRun = false,
  connected = false,
}: IdcResourceTableProps) => {
  const has = (c: IdcTableCol) => cols.includes(c);
  // Step 2·3 (`excl`) show excluded rows too; Step 4~7 show integration targets only.
  const rows = has('excl') ? resources : resources.filter((r) => !r.excluded);

  // Display-only pagination; per-step gating runs over the full list in the step
  // components, so slicing the view here is safe.
  // 5 는 승인 모달의 크기다. `connected` 호출자는 목록을 스스로 잘라 이 페이저를 건너뛰므로
  // (아래 `pageRows`), 이 값이 닿는 곳은 non-connected 갈래 = 그 모달 하나뿐이다.
  const { page, pageSize, setPage, setPageSize, pageItems: paged } = usePagination(rows, {
    initialPageSize: 5,
  });
  // `connected` callers slice the list themselves (their toolbar owns the filter state), so the
  // internal pager is bypassed rather than rendered twice.
  const pageRows = connected ? rows : paged;

  // 출발지는 steps 5·6·7 에서 맨 오른쪽으로 간다: 그 화면들의 주어는 이미 확정된 대상이고
  // 출발지는 전제라, 정체성 열들 사이에 끼면 접속 주소~Database Type 을 갈라놓는다.
  // step 3 은 아직 대상을 고르는 화면이라 앞자리를 지킨다.
  const srcAtEnd = cols[cols.length - 1] === 'src';
  const columns = idcColumns(has, srcAtEnd);

  // One store for every step surface — cross-step alignment of the shared identity columns
  // (접속/Port/Database Type/출발지) is this table's founding complaint, so a width chosen on
  // step 2 IS the width on step 6. The 승인 모달 stays ephemeral (no storageKey): its pane is
  // 712px, and a 400px endpoint dragged on a full-width step would force the dialog to scroll
  // before its owner ever touched it.
  const resize = useColumnResize({
    clampToContent: true,
    storageKey: connected ? 'pii:colw:v1:idc-resources' : undefined,
    ephemeralKeys: IDC_FLEX_KEYS,
  });

  if (rows.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? '표시할 연동 대상이 없습니다.'}
      </div>
    );
  }

  return (
    <>
    {/* Both frames hold the same console table now. `connected` keeps the borderless join
        (toolbar above, caller's pager below); the dialog keeps its bordered paged frame.
        The old per-skin thead/cell split is gone — ConsoleTable owns the header, and the
        dialog accepts the console header (12px flat) over its former 14px one: one grammar,
        looked at from a modal. */}
    <div className={connected ? CONNECTED_FRAME : idcStyles.table.framePaged}>
      <ConsoleTable columns={columns} resize={resize}>
        <tbody className={idcStyles.table.body}>
          {pageRows.map((r) => {
            // 제외 행을 흐리게 하지 않는다: 승인 화면에서 제외 행은 가장 감사해야 하는 행이고,
            // opacity-50 은 그 위 모든 텍스트의 대비를 AA 아래로 떨어뜨렸다. 표시는 레일이 맡는다.
            return (
              <tr key={r.resourceId} className={cn(ROW_BASE, r.excluded ? ROW_EXCLUDED : ROW_TARGET)}>
                {/* 판정 레일은 첫 칸이 진다 — 구분이 빠지면서 그 자리가 접속 주소로 넘어왔다.
                    max-w-full: 콘솔 열이 잘림 지점을 소유한다 (HostCell 의 두 폭 모드). */}
                <td className={cn(VALUE_CELL, verdictRailClass(r.excluded))}>
                  <IdcEndpointWithKindCell resource={r} maxWidthClass="max-w-full" />
                </td>
                {/* 0 is the adapter's "no port in the payload" value, not a port — an em-dash
                    says the field is missing instead of asserting a nonsense one. */}
                <td className={cn(VALUE_CELL, 'font-mono text-[12px]', textColors.secondary, CELL_LIFT)}>
                  {r.port || <span className={textColors.tertiary}>—</span>}
                </td>
                <td className={VALUE_CELL}>
                  <IdcDbTypeCell resource={r} sidMaxWidthClass="max-w-full" />
                </td>
                {!srcAtEnd && has('src') && (
                  <td className={VALUE_CELL}>
                    <IdcSourceIpCell sourceIps={r.sourceIps} maxWidthClass="max-w-full" />
                  </td>
                )}
                {has('excl') && (
                  <>
                    <td className={idcStyles.table.approvalCell}>
                      <TargetPill excluded={r.excluded} />
                    </td>
                    {/* Blank, not an em-dash: a 대상 row can never carry a reason. */}
                    <td className={cn(VALUE_CELL, 'text-sm')}>
                      {r.excluded && r.exclusionReason ? (
                        <ReasonChipInline
                          reason={r.exclusionReason}
                          summary={clampReason(r.exclusionReason)}
                        />
                      ) : null}
                      {/* IDC 는 recommend_fail_reason 이 없다(계약: GCP·Azure 전용) — 사유는 늘 사람이 쓴 문장이다. */}
                    </td>
                  </>
                )}
                {/* 값은 밑줄 텍스트로 읽고 수정은 모달에서 — 클라우드 step 5 와 같은 문법이다.
                    행마다 select 를 놓으면 표가 컨트롤 판이 되고, 고르는 순간 저장돼 두 후보를
                    비교할 수도 없다. IDC 는 모든 대상이 자격 증명을 요구하므로 "불필요" 는 없다. */}
                {has('cred') && (
                  <td className={VALUE_CELL}>
                    <button
                      type="button"
                      onClick={() => onCredentialOpen?.(r)}
                      aria-label={`${r.hosts[0] ?? r.resourceId} Credential 수정 — 현재 ${credentials?.[r.resourceId] || '미설정'}`}
                      title={credentials?.[r.resourceId] || undefined}
                      // max-w-[144px] (= 180 − 좌우 패딩 36) 는 콘솔에서도 유지한다: 이 값은
                      // 열 폭이 아니라 '한 버튼이 차지할 수 있는 상한'이고, 드래그로 열을
                      // 늘리는 이유는 Credential 이름이 아니라 이웃 flex 열을 위해서다.
                      className={cn(idcStyles.triggerBtn.linkNeutral, 'max-w-[144px]')}
                    >
                      {credentials?.[r.resourceId] ? (
                        <span className="min-w-0 truncate font-mono">{credentials[r.resourceId]}</span>
                      ) : (
                        <span className="font-sans">미설정</span>
                      )}
                    </button>
                  </td>
                )}
                {has('conn') && (
                  <td className={idcStyles.table.approvalCell}>
                    <TcStatusTag
                      status={connectionStatusByResource?.get(r.resourceId)}
                      hasRun={connectionHasRun}
                      loading={connectionLoading}
                    />
                  </td>
                )}
                {has('logicalro') && (
                  <>
                    {/* `onLogicalOpen` 이 없으면 셀에 onOpen 을 **주지 않는다**. `() => x?.(r)`
                        는 언제나 truthy 라, 열 곳이 없는 화면(확인 모달)에서도 숫자가 눌리는
                        버튼으로 그려졌다 — LogicalDbCountCell 이 "아무 일도 안 하는 컨트롤
                        대신 평문" 이라고 정해 둔 바로 그 상태다. */}
                    <td className={idcStyles.table.approvalCell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.target ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 논리 DB 목록 보기`}
                        onOpen={onLogicalOpen ? () => onLogicalOpen(r) : undefined}
                      />
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.excluded ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 제외 대상 보기`}
                        onOpen={onLogicalOpen ? () => onLogicalOpen(r) : undefined}
                      />
                    </td>
                  </>
                )}
                {srcAtEnd && has('src') && (
                  <td className={VALUE_CELL}>
                    <IdcSourceIpCell sourceIps={r.sourceIps} maxWidthClass="max-w-full" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </ConsoleTable>
    </div>
    {/* 클라우드 승인 모달과 같은 페이저다 — 이 갈래의 소비자가 그 모달의 IDC 짝뿐이라,
        같은 상자가 같은 질문을 하면서 페이지를 다르게 넘길 이유가 없다. */}
    {!connected && (
    <Pagination
      size="md"
      page={page}
      pageSize={pageSize}
      totalCount={rows.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      pageSizeOptions={[5, 10]}
    />
    )}
    </>
  );
};
