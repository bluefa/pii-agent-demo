'use client';

/**
 * 연결 테스트 근거 행의 펼침 본문 — 리소스별 검토 표 (시안 C-2).
 *
 * 연결 테스트 탭 확정 정보 표(ConfirmedInfoCard)의 읽기 전용 절반이다: 같은 셀 문법
 * (confirmedTableBits, Step 6·7 스켈레톤)으로 같은 리소스를 그리되, 쓰기 표면
 * (Credential 배정·제외 정책 편집)은 들이지 않는다 — 결정 화면에 쓰기가 들어오면
 * 카드 4장이 다른 모양으로 돌아온다. 개수 클릭은 읽기 전용 논리 DB 목록(LdbViewModal)만
 * 연다. 정체성 열은 모니터링 표와 같아서 두 근거를 행 단위로 대조할 수 있다.
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { Dash } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  CONFIRMED_CELL,
  CONFIRMED_HEAD_CELL,
  ConnCell,
  IdcIdentityCell,
  ResourceNameCell,
  confirmedRowLabel,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/confirmedTableBits';
import { LdbViewModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbViewModal';
import {
  ldbCount,
  type LdbTab,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** One page's worth — 확정 정보 표와 같은 눈금. */
const PAGE_SIZE = 10;

/** 검토 표는 툴바가 없어 네 귀가 모두 둥글다 (확정 정보 표의 프레임에서 툴바 몫을 뺀 것). */
const TABLE_FRAME = 'overflow-x-auto rounded-[10px] border border-[var(--pl-border)]';

/**
 * Contract-declared count — absent (no TC row / not a success) renders —, never 0.
 * 확정 정보 표의 CountCell 과 같은 옷이지만 여는 것이 다르다: 여기서는 읽기 전용
 * 목록(LdbViewModal)만 연다.
 */
function ReviewCountCell({
  row,
  tab,
  verdict,
  onOpen,
}: {
  row: TcResultRow | undefined;
  tab: LdbTab;
  verdict: TcVerdict | undefined;
  onOpen: () => void;
}): ReactElement {
  const count = ldbCount(row, tab, verdict);
  if (count == null) return <Dash />;
  if (count === 0) return <span className={opsStyles.countZero}>0개</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${tab === 'inc' ? '연동 대상' : '연동 제외'} 논리 DB ${count}개 보기`}
      className={opsStyles.countLink}
    >
      {count}
      <span className="text-[12px] font-medium">개</span>
    </button>
  );
}

export interface TcReviewTableProps {
  targetSourceId: number;
  /** IDC renders one 접속 주소 column instead of Resource Name · Resource ID · Region. */
  isIdc: boolean;
  /** 확정 스냅샷 fetch 의 상태 — 빈 rows 가 '없음'인지 '모름'인지 가른다 (리뷰 08-21). */
  snapshotPhase: 'loading' | 'failed' | 'loaded';
  /** Confirmed snapshot resources — 연동 요청(Step 2) 순서로 정렬된 것. */
  rows: readonly ConfirmedIntegrationResourceItem[];
  /** 논리 DB 건수 rows (latest-results), joined by resource_id. */
  tcResults: readonly TcResultRow[];
  /** 리소스별 연결 판정 (latest_version), joined by resource_id. */
  verdicts: ReadonlyMap<string, TcVerdict>;
}

export function TcReviewTable({
  targetSourceId,
  isIdc,
  snapshotPhase,
  rows,
  tcResults,
  verdicts,
}: TcReviewTableProps): ReactElement {
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [page, setPage] = useState(0);

  const tcByResourceId = new Map(tcResults.map((row) => [row.resourceId, row]));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const { table } = opsStyles;

  if (rows.length === 0) {
    // 세 문장이 갈라진다 (리뷰 08-21): 아직 모름(로딩)·못 받음(실패)·정말 없음(로드됨).
    // 실패를 "없다"로 적으면 화면이 읽지도 못한 사실을 단정한다 — 실패는 빈 결과가 아니다.
    return (
      <p
        className="py-4 text-center text-[14px] text-[var(--pl-text-weak)]"
        aria-busy={snapshotPhase === 'loading' || undefined}
      >
        {snapshotPhase === 'loading'
          ? '확정 정보를 확인하고 있어요…'
          : snapshotPhase === 'failed'
            ? '확정 정보를 불러오지 못해 리소스별 검토 표를 그릴 수 없습니다.'
            : '확정된 연동 정보가 없어 리소스별 검토 표를 그릴 수 없습니다.'}
      </p>
    );
  }

  return (
    <>
      <div className={TABLE_FRAME}>
        <table className={table.base}>
          <thead className="bg-[var(--pl-gray-50)]">
            <tr>
              {isIdc ? (
                <th className={CONFIRMED_HEAD_CELL}>접속 주소</th>
              ) : (
                <>
                  <th className={CONFIRMED_HEAD_CELL}>Resource Name</th>
                  <th className={CONFIRMED_HEAD_CELL}>Resource ID</th>
                </>
              )}
              <th className={CONFIRMED_HEAD_CELL}>Database Type</th>
              {!isIdc && <th className={CONFIRMED_HEAD_CELL}>Region</th>}
              <th className={CONFIRMED_HEAD_CELL}>연동 대상 논리 DB</th>
              <th className={CONFIRMED_HEAD_CELL}>연동 제외 논리 DB</th>
              <th className={CONFIRMED_HEAD_CELL}>연결 상태</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {pageRows.map((row, index) => {
              const tc = tcByResourceId.get(row.resource_id);
              const verdict = verdicts.get(row.resource_id);
              return (
                <tr key={`${row.resource_id}-${index}`} className={table.rowHover}>
                  {isIdc ? (
                    <td className={CONFIRMED_CELL}>
                      <IdcIdentityCell row={row} />
                    </td>
                  ) : (
                    <>
                      <td className={CONFIRMED_CELL}>
                        <ResourceNameCell
                          value={row.resource_name || null}
                          resourceType={row.resource_type}
                        />
                      </td>
                      <td className={CONFIRMED_CELL}>
                        {row.resource_id ? (
                          <ResourceIdCell
                            value={row.resource_id}
                            label="Resource ID"
                            maxWidthClass="max-w-[200px]"
                          />
                        ) : (
                          <Dash />
                        )}
                      </td>
                    </>
                  )}
                  <td className={cn(CONFIRMED_CELL, 'whitespace-nowrap')}>
                    {row.database_type ? getDatabaseShortLabel(row.database_type) : <Dash />}
                  </td>
                  {!isIdc && (
                    <td className={cn(CONFIRMED_CELL, 'whitespace-nowrap font-mono')}>
                      {row.database_region || <Dash />}
                    </td>
                  )}
                  <td className={CONFIRMED_CELL}>
                    <ReviewCountCell row={tc} tab="inc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                  </td>
                  <td className={CONFIRMED_CELL}>
                    <ReviewCountCell row={tc} tab="exc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                  </td>
                  <td className={CONFIRMED_CELL}>
                    <ConnCell verdict={verdict} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* footer 는 항상 선다 (오너 08-21) — 표준 페이저 단독, 가운데 (다른 모든
          OpsPagination 사용처와 같은 문법). "1–2 / 2" 범위 텍스트는 기각됐다:
          개수는 위 kv 줄이 이미 말하고, 분수 표기는 고장처럼 읽힌다. */}
      <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />

      {ldbRow && (
        <LdbViewModal
          key={`ldb-view-${ldbRow.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={ldbRow.resource_id}
          resourceLabel={confirmedRowLabel(ldbRow)}
          databaseType={ldbRow.database_type}
          onClose={() => setLdbRow(null)}
        />
      )}
    </>
  );
}
