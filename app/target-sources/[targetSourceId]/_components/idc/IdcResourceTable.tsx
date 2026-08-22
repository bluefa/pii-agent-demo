'use client';

import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { ReasonChipInline } from '@/app/components/ui/ReasonChipInline';
import { cn, idcStyles, textColors, verdictRailClass } from '@/lib/theme';
import { IDC_SOURCE_IP_TOOLTIP, IDC_SOURCE_LABEL } from '@/lib/constants/idc';
import type { IdcInstallStatus, IdcResourceView } from '@/app/lib/api/idc';
import {
  IdcDbTypeCell,
  IdcEndpointWithKindCell,
  IdcFirewallBadge,
  IdcHealthBadge,
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
 */
export type IdcTableCol =
  | 'src'
  | 'excl'
  | 'fw'
  | 'health'
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
   * Render in the CSP approval-table skin (step 6): the borderless frame that joins under a
   * toolbar, the 12px/600 approval header, 18/16 cell padding and the readable row-hover lift.
   * Pagination moves to the caller, which owns the toolbar's filter state — same contract as
   * WaitingApprovalTable's own `connected`.
   */
  connected?: boolean;
  /**
   * Step-4 `fw` column only: per-resource firewall step status keyed by
   * resourceId, sourced from the installation-status `firewall_check.status`
   * (the confirmed-integration rows have no firewall field). A missing entry
   * renders the neutral "BDC측 확인 필요" badge.
   */
  firewallStatusByResource?: Readonly<Record<string, IdcInstallStatus>>;
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
  firewallStatusByResource,
}: IdcResourceTableProps) => {
  const has = (c: IdcTableCol) => cols.includes(c);
  // Step 2·3 (`excl`) show excluded rows too; Step 4~7 show integration targets only.
  const rows = has('excl') ? resources : resources.filter((r) => !r.excluded);

  // Display-only pagination; per-step gating runs over the full list in the step
  // components, so slicing the view here is safe.
  const { page, pageSize, setPage, setPageSize, pageItems: paged } = usePagination(rows, {
    initialPageSize: 10,
  });
  // `connected` callers slice the list themselves (their toolbar owns the filter state), so the
  // internal pager is bypassed rather than rendered twice.
  const pageRows = connected ? rows : paged;

  const skin = connected
    ? {
        frame: CONNECTED_FRAME,
        header: idcStyles.table.approvalHeader,
        headerCell: idcStyles.table.approvalHeaderCell,
        cell: idcStyles.table.approvalCell,
      }
    : {
        frame: idcStyles.table.frame,
        header: idcStyles.table.header,
        headerCell: idcStyles.table.headerCell,
        cell: idcStyles.table.cell,
      };

  // 출발지는 steps 5·6·7 에서 맨 오른쪽으로 간다: 그 화면들의 주어는 이미 확정된 대상이고
  // 출발지는 전제라, 정체성 열들 사이에 끼면 접속 주소~Database Type 을 갈라놓는다.
  // step 3 은 아직 대상을 고르는 화면이라 앞자리를 지킨다.
  const srcAtEnd = cols[cols.length - 1] === 'src';
  const srcHead = has('src') ? (
    <th className={cn(skin.headerCell, 'w-[144px]')}>
      <SourceIpHeader />
    </th>
  ) : null;
  const srcCell = (r: IdcResourceView) =>
    has('src') ? (
      <td className={skin.cell}>
        <IdcSourceIpCell sourceIps={r.sourceIps} />
      </td>
    ) : null;

  if (rows.length === 0) {
    return (
      <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
        {emptyMessage ?? '표시할 연동 대상이 없습니다.'}
      </div>
    );
  }

  return (
    <>
    <div className={skin.frame}>
      <table className="w-full">
        <thead className={skin.header}>
          <tr>
            {/* 구분은 제 열을 갖지 않는다 — 배지가 주소 위에 얹힌다(IdcEndpointWithKindCell).
                200 은 HostCell 이 이미 쓰던 max-w — 잘림 계약이 그 폭에 맞춰 쓰여 있다. */}
            <th className={cn(skin.headerCell, 'w-[200px]')}>접속 주소</th>
            <th className={cn(skin.headerCell, 'w-[80px]')}>Port</th>
            {/* Declared, not auto. As the only un-widthed column it was the slack sink: with the
                six columns of steps 2·3 it rendered 306px against the 172px it takes on step 6,
                so the same four leading columns did not line up between steps. 172 is step 6's
                own width — the widest engine label plus its SID line fits. */}
            <th className={cn(skin.headerCell, 'w-[172px]')}>Database Type</th>
            {!srcAtEnd && srcHead}
            {/* Two columns, not one merged cell: the verdict and the why answer different
                questions, which is how the cloud steps 2·3 table asks them. */}
            {has('excl') && (
              <>
                <th className={cn(skin.headerCell, 'w-[112px]')}>요청 대상 여부</th>
                {/* The flexible one on these steps: the reason is the only free-text value in a
                    row, so leftover width belongs to it, not to an attribute column. */}
                <th className={skin.headerCell}>제외 사유</th>
              </>
            )}
            {has('fw') && <th className={skin.headerCell}>접근 허용 상태</th>}
            {has('cred') && <th className={cn(skin.headerCell, 'w-[180px]')}>Credential</th>}
            {/* Credential 다음, 논리 DB 앞 — 클라우드 step 5 의 열 순서 그대로다(자격 증명 →
                그것으로 접속한 결과 → 그 결과로 여는 논리 DB). */}
            {has('conn') && <th className={cn(skin.headerCell, 'w-[104px]')}>연결 상태</th>}
            {has('logicalro') && (
              <>
                <th className={cn(skin.headerCell, 'w-[120px]')}>연동 논리 DB</th>
                <th className={skin.headerCell}>연동 제외</th>
              </>
            )}
            {has('health') && <th className={skin.headerCell}>Status</th>}
            {srcAtEnd && srcHead}
          </tr>
        </thead>
        <tbody className={idcStyles.table.body}>
          {pageRows.map((r) => {
            // 제외 행을 흐리게 하지 않는다: 승인 화면에서 제외 행은 가장 감사해야 하는 행이고,
            // opacity-50 은 그 위 모든 텍스트의 대비를 AA 아래로 떨어뜨렸다. 표시는 레일이 맡는다.
            return (
              <tr
                key={r.resourceId}
                className={
                  connected
                    ? cn(ROW_BASE, r.excluded ? ROW_EXCLUDED : ROW_TARGET)
                    : cn(idcStyles.table.row, r.excluded && 'bg-[#F7F8FA]')
                }
              >
                {/* 판정 레일은 첫 칸이 진다 — 구분이 빠지면서 그 자리가 접속 주소로 넘어왔다. */}
                <td className={cn(skin.cell, verdictRailClass(r.excluded))}>
                  <IdcEndpointWithKindCell resource={r} />
                </td>
                {/* 0 is the adapter's "no port in the payload" value, not a port — an em-dash
                    says the field is missing instead of asserting a nonsense one. */}
                <td className={cn(skin.cell, 'font-mono text-[12px]', textColors.secondary, CELL_LIFT)}>
                  {r.port || <span className={textColors.tertiary}>—</span>}
                </td>
                <td className={skin.cell}><IdcDbTypeCell resource={r} /></td>
                {!srcAtEnd && srcCell(r)}
                {has('excl') && (
                  <>
                    <td className={skin.cell}>
                      <TargetPill excluded={r.excluded} />
                    </td>
                    {/* Blank, not an em-dash: a 대상 row can never carry a reason. */}
                    <td className={cn(skin.cell, 'text-sm')}>
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
                {has('fw') && <td className={skin.cell}><IdcFirewallBadge status={firewallStatusByResource?.[r.resourceId]} /></td>}
                {/* 값은 밑줄 텍스트로 읽고 수정은 모달에서 — 클라우드 step 5 와 같은 문법이다.
                    행마다 select 를 놓으면 표가 컨트롤 판이 되고, 고르는 순간 저장돼 두 후보를
                    비교할 수도 없다. IDC 는 모든 대상이 자격 증명을 요구하므로 "불필요" 는 없다. */}
                {has('cred') && (
                  <td className={skin.cell}>
                    <button
                      type="button"
                      onClick={() => onCredentialOpen?.(r)}
                      aria-label={`${r.hosts[0] ?? r.resourceId} Credential 수정 — 현재 ${credentials?.[r.resourceId] || '미설정'}`}
                      title={credentials?.[r.resourceId] || undefined}
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
                  <td className={skin.cell}>
                    <TcStatusTag
                      status={connectionStatusByResource?.get(r.resourceId)}
                      hasRun={connectionHasRun}
                      loading={connectionLoading}
                    />
                  </td>
                )}
                {has('logicalro') && (
                  <>
                    <td className={skin.cell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.target ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 논리 DB 목록 보기`}
                        onOpen={() => onLogicalOpen?.(r)}
                      />
                    </td>
                    <td className={skin.cell}>
                      <LogicalDbCountCell
                        count={logicalDbCounts?.get(r.resourceId)?.excluded ?? null}
                        label={`${r.hosts[0] ?? r.resourceId} 연동 제외 대상 보기`}
                        onOpen={() => onLogicalOpen?.(r)}
                      />
                    </td>
                  </>
                )}
                {has('health') && <td className={skin.cell}><IdcHealthBadge health={r.health} /></td>}
                {srcAtEnd && srcCell(r)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {!connected && (
    <Pagination
      page={page}
      pageSize={pageSize}
      totalCount={rows.length}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      pageSizeOptions={[10, 20, 50, 100]}
      controls="prevNext"
    />
    )}
    </>
  );
};
