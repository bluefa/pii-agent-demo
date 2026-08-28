'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import {
  ConsoleTable,
  type ConsoleTableColumn,
  type ConsoleTableGroup,
} from '@/app/components/ui/ConsoleTable';
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
import { LogicalDbGroupHeader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbGroupHeader';
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
 *   [logicalro]                 승인 모달   200+80+172+96+96           =  644
 *   [excl]                      step 2     200+80+172+116+142         =  710
 *   [src,excl]                  step 3     200+80+172+144+116+142     =  854
 *   [cred,conn,logicalro,src]   step 5     200+80+172+200+104+96+96+96+144 = 1188
 *   [logicalro,src]  +관리      (없음)     200+80+172+96+96+96+144    =  884
 *   [logicalro,src]  -관리      steps 6·7  200+80+172+96+96+144       =  788
 *
 * ⚠️ `cols` alone does NOT fix the sum. The 관리 열 is decided by `onLogicalOpen`, not by
 * `cols` (`canManageLogical` below), so `[logicalro,src]` has TWO floors — 884 with the
 * handler, 788 without. Steps 6·7 are the only callers of that combo and they pass no
 * handler, so the number that ships on those screens is 788; 884 is the arithmetic of the
 * same combo WITH a handler and no surface renders it today. Grep the combo and you get
 * two rows on purpose.
 *
 * 시안 B (오너 2026-08-27): 연동 논리 DB 가 2열 → **그룹 머리 + 3열**(대상·제외·관리) 이
 * 되면서 이 세 줄이 움직였다. 열 머리가 이제 `대상`/`제외` 라 118 은 `연동 논리 DB` 를
 * 담으려던 폭이고 더 필요 없다 — 셋 다 96(옛 logicalExcl 값)으로 내려 앉는다.
 * 관리 열은 `onLogicalOpen` 이 있을 때만 선다: 승인 모달은 그것을 주지 않으므로 거기서는
 * 2열이고, 합이 666 → 644 로 오히려 줄어 712px 판의 여유가 46 → 68 이 된다.
 * step 5 는 1178 → 1252 다. 가로 스크롤이 더 일찍 시작되는 것을 안건과 함께 받아들였다.
 *
 * Round 19 (owner 2026-08-27): the console header went 12 → 14px (`approvalHeaderFlat`), and
 * `요청 대상 여부` — the ONLY label in any of these tables that no longer fit — measured 77.27px
 * against a 75px content box and clipped to `요청 대상 ...`. The label stays (shortening it to
 * `요청 대상` was put to the owner and rejected), so `target` goes 112 → 116: 77.27 + 36 padding
 * + the 1px rail = 114.27, and 116 is the smallest value that clears it. Only the two rows
 * carrying `target` move — [excl] 706 → 710 and [src,excl] 850 → 854. 승인 모달 644, step 5
 * 1252 and the [logicalro,src] 884 have no `target` column and are arithmetically untouched.
 *
 * 오너 2026-08-27 (같은 날, 뒤): "6,7단계에서는 관리하기가 없어." step 5 의 `onLogicalOpen`
 * 은 정책을 **쓰는** LogicalDbModal 을 열지만(IdcStep5ConnectionTest 의 handleLogicalOpen +
 * handleLogicalSaved), 6·7 단계에는 쓸 것이 없다 — 승인 뒤의 두 수는 기록이지 조작 대상이
 * 아니다. 아무것도 관리하지 않는 `관리하기` 문은 그 행이 할 수 있는 일에 대한 거짓말이라,
 * IdcConfirmedResourcesPanel 이 만들어 내던 대체 핸들러를 걷어냈다. 그래서 6·7 단계가
 * 884 → 788 로 움직였다(관리 96 을 뺀 값). 움직이지 않은 줄: 승인 모달 644 는 애초에 관리
 * 열이 없었고, step 5 1252 는 관리 열을 그대로 지킨다.
 *
 * Ledger corrections landed with the migration: 연동 논리 DB 120 → 118, and the two
 * previously UN-declared columns get numbers (제외 사유 142 · 연동 제외 96) — under
 * table-fixed an undeclared column is not "auto slack", it is a bug. cred went 180 → 264
 * by owner order (2026-08-23) and 264 → 200 by owner order (2026-08-27); the paragraph
 * below carries both, and the second corrects the first's arithmetic.
 *
 * cred 264 → 200 (오너 2026-08-27, "Credential width를 좀 줄이자"). 264 는 가장 긴 시드 이름
 * `kimcs-postgres-analytics-readonly` 를 통째로 보이려던 폭이었고 그 근거는 13px/600 실측
 * 203.37px + 패딩 36 + 여유 25 였다. 14px 행 라운드가 그 여유를 조용히 먹었다 — 같은 이름을
 * 셀의 실제 계산 스타일(14px/600 Pretendard)로 /pass/target-sources/1024 에서 다시 재면
 * **219.74px** 이고(13px 값도 그대로 재현됐으니 옛 기록 자체는 옳았다, 셀이 커진 것이다),
 * 219.74 + 36 = 255.74 라 264 에 남은 여유는 **8.26px** 이었다. 즉 이것은 새 사실이 아니라
 * 옛 기록의 정정이다: 이 열은 넉넉했던 적이 없다.
 *
 * 그리고 가장 긴 시드 이름과 그 다음 이름 사이에는 **70px 절벽**이 있다 — 219.74 대
 * `jhpark-mssql-payments` 149.21, 이어서 141.71 · 132.27 · 126.07. 열은 그 이상치를 싣거나
 * 싣지 않거나 둘 중 하나이고, ~200 과 ~256 사이의 어떤 값도 사는 것이 없다. 200 = 149.21 +
 * 패딩 36 + **여유 14.79** 라 `kimcs-postgres-analytics-readonly` 하나만 말줄임되고 나머지
 * 시드 이름은 전부 통째로 든다. 200 이 받아들일 만한 이유는 말줄임 경로가 이미 서 있기
 * 때문이다 — 값 span 이 `truncate`, 버튼이 `title={전체 이름}` 을 들고 있어(아래 cred 칸)
 * 긴 이름은 말줄임 + 네이티브 툴팁으로 내려앉지 조용히 잘리지 않는다.
 *
 * step 5 는 1252 → **1188** 이다(cred 만 움직였으므로 정확히 −64). `cred` 열이 없는 줄은
 * 산술적으로 그대로다: 승인 모달 644, step 2 710, step 3 854, [logicalro,src] 884/788.
 * ⚠️ 위 라운드 문단들의 1178·1252 는 그 라운드 당시의 값이다 — 지금 유효한 바닥은 원장 표다.
 *
 * ⚠️ Step 5's 1188 exceeds the panel at common widths — ConsoleTable's own wrapper is
 * the overflow-x-auto escape hatch the legacy frame never had (ledger ⚠️⁴). The 승인
 * 모달 combo (644) fits its 712px pane with ~68px of slack for the flex column.
 */
/**
 * 열 폭. Airflow 확인 탭의 리소스 표가 IDC 대상에서 이 표의 정체 열(접속 주소·Port·
 * Database Type)을 그대로 쓰므로 export 다 — 값을 손으로 베끼면 census 가 못 보는
 * 사본이 되고, 이 표가 폭을 바꾸는 날 그쪽만 옛 값으로 남는다.
 */
export const IDC_COLUMN_WIDTHS = {
  endpoint: 200,
  port: 80,
  dbType: 172,
  src: 144,
  target: 116,
  reason: 142,
  cred: 200,
  conn: 104,
  logicalDb: 96,
  logicalExcl: 96,
  logicalManage: 96,
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
  /** 관리 열은 열 곳이 있을 때만 선다 — 확인 모달은 `onLogicalOpen` 을 주지 않는다. */
  canManage: boolean,
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
    // 시안 B — 셋은 `연동 논리 DB` 그룹 머리 아래 선다(`idcGroups`). 그래서 열 이름이
    // 카테고리를 되풀이하지 않고 `대상`/`제외`/`관리` 한 마디로 짧아진다.
    ...(has('logicalro')
      ? [
          { key: 'logicalDb', label: '대상', width: IDC_COLUMN_WIDTHS.logicalDb },
          { key: 'logicalExcl', label: '제외', width: IDC_COLUMN_WIDTHS.logicalExcl },
          ...(canManage
            ? [{ key: 'logicalManage', label: '관리', width: IDC_COLUMN_WIDTHS.logicalManage }]
            : []),
        ]
      : []),
    ...(has('src') && srcAtEnd ? [src] : []),
  ];
};

/** 두 tier 헤더 — 셋(또는 관리 없이 둘)을 한 이름 아래로 묶는다. */
const idcGroups = (has: (c: IdcTableCol) => boolean, canManage: boolean): ConsoleTableGroup[] =>
  has('logicalro')
    ? [
        {
          key: 'logicalro',
          label: '연동 논리 DB',
          head: <LogicalDbGroupHeader />,
          columns: canManage
            ? ['logicalDb', 'logicalExcl', 'logicalManage']
            : ['logicalDb', 'logicalExcl'],
        },
      ]
    : [];

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
  const canManageLogical = has('logicalro') && !!onLogicalOpen;
  const columns = idcColumns(has, srcAtEnd, canManageLogical);
  const groups = idcGroups(has, canManageLogical);

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
      <ConsoleTable columns={columns} groups={groups} resize={resize}>
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
                <td className={cn(VALUE_CELL, 'font-mono text-[14px]', textColors.secondary, CELL_LIFT)}>
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
                      // 컷은 열이 소유한다(max-w-full): 픽셀 캡이 남아 있으면 열을 드래그로
                      // 늘려도 이름이 더 안 보이는 리사이즈 벽이 된다. 200 열은 시드 실명
                      // 대부분을 통째로 보여주고, 가장 긴 하나만 말줄임된다 —
                      // `kimcs-postgres-analytics-readonly` 는 14px 에서 219.74px 라 149.21px 인
                      // 다음 이름과 70px 떨어져 있고, 그 하나를 위해 열이 매 행 64px 를 들고
                      // 있을 값이 아니었다. 잘린 값은 `title` 툴팁이 통째로 되돌려 준다.
                      // linkNeutralMd = linkNeutral at 14px. 행이 한 눈금으로 읽히도록
                      // 옮겼다 (오너 2026-08-27) — `linkNeutral`(13px) 자체는 5·6단계
                      // 카드의 링크들이 계속 들고 있어 건드리지 않는다.
                      className={cn(idcStyles.triggerBtn.linkNeutralMd, 'max-w-full')}
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
                    {/* 시안 B — 수는 **값**이고 행위는 옆 칸의 이름 붙은 버튼이다.
                        전에는 두 수가 각자 버튼이었는데 둘 다 같은 모달을 열었다: 문이
                        둘로 보이지만 방은 하나라, 어느 쪽을 눌러야 하는지 고르는 일이
                        아무것도 바꾸지 않았다. 이제 수는 평문(onOpen 을 주지 않는다 —
                        LogicalDbCountCell 의 "아무 일도 안 하는 컨트롤 대신 평문" 갈래)
                        이고, 문은 하나이며 이름을 갖는다. */}
                    <td className={idcStyles.table.approvalCell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.target ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 대상 논리 DB`}
                      />
                    </td>
                    <td className={idcStyles.table.approvalCell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.excluded ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 제외 논리 DB`}
                      />
                    </td>
                    {/* 건수와 무관하게 언제나 선다. 제외 정책은 실행이 만드는 것이 아니라
                        운영자가 쓰는 것이라, 아직 보고가 없거나(—) 0건인 리소스 — 정책을
                        가장 손봐야 할 리소스 — 에도 문이 있어야 한다. 어휘는 클라우드
                        5단계의 `관리하기` 를 그대로 쓴다. */}
                    {canManageLogical && (
                      <td className={idcStyles.table.approvalCell}>
                        <button
                          type="button"
                          onClick={() => onLogicalOpen?.(r)}
                          // 행마다 반복되는 버튼은 자기 행을 이름표에 실어야 한다 — 같은
                          // 이름의 버튼 열 개는 스크린리더에서 구별되지 않는다.
                          aria-label={`${r.hosts[0] ?? r.resourceId} 연동 논리 DB 관리하기`}
                          className={idcStyles.triggerBtn.rowAction}
                        >
                          관리하기
                        </button>
                      </td>
                    )}
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
