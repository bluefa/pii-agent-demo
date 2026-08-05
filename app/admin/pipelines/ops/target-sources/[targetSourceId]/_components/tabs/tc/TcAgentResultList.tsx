'use client';

/**
 * 실행이 보고한 agent 결과 — 최근 연결 테스트 카드의 3단(가장 아래) 계층.
 *
 * 카드의 계층: 이 실행이 통과했나(제목행 #N + pill) → 얼마나(집계 타일) → 어느 것(여기).
 * 그래서 이 블록은 위와 구분선으로 끊고, 자기 제목(13/600)을 따로 갖는다.
 *
 * 30건 규모를 전제로 짠 목록이다 —
 *  - 판정 필터가 목록의 주 조작이다. 실행 중에도 똑같이 걸려서 "지금 실패한 것만",
 *    "아직 시작도 안 한 것만"을 실행이 끝나기 전에 볼 수 있다. 그래서 필터 칩은
 *    0건이어도 자리를 지킨다 — 실행 중에 칩이 생겼다 사라지면 누르려던 자리가 옮겨간다
 *  - 페이지당 8건. 카드가 목록 길이만큼 늘어나지 않으니 아래 확정 정보 표가 밀리지
 *    않고, 마지막 페이지가 짧아도 높이가 그대로다(min-h)
 *  - 판정별로 세우고 실패를 맨 위에 둔다. wire 순서에는 의미가 없다 (확정 정보 표는
 *    Step 2 요청 순서를 지키지만, 그건 다른 질문에 답하는 표다)
 *  - 판정 열은 '전체'일 때만 붙인다. 필터를 걸면 칩이 이미 판정을 말했고, 30줄의 같은
 *    pill 은 목록을 덮기만 한다
 *  - 리소스 이름은 경로의 마지막 세그먼트만 쓴다. 30줄의 앞부분이 전부 같아 절단이
 *    공통 접두사만 남기던 자리였다. 전체 id 는 hover 로, 복사는 확정 정보 표에 있다
 */
import { useState, type ReactElement } from 'react';
import { SegControl } from '@/app/admin/pipelines/_components/SegControl';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import {
  Dash,
  TcPill,
  resourceIdTail,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  countAgentVerdicts,
  runProgress,
  sortAgentRows,
  type TcAgentRow,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** 한 페이지 8행 — 카드 높이를 목록 길이에서 떼어내는 값. */
const PAGE_SIZE = 8;

const VERDICT_PILL: Record<TcVerdict, { tone: 'ok' | 'err' | 'warn' | 'off'; label: string }> = {
  FAIL: { tone: 'err', label: '실패' },
  RUNNING: { tone: 'warn', label: '진행 중' },
  PENDING: { tone: 'off', label: '대기' },
  UNKNOWN: { tone: 'off', label: '미확인' },
  SUCCESS: { tone: 'ok', label: '성공' },
};

/**
 * 항상 자리를 지키는 칩. UNKNOWN 은 계약 enum 밖의 값이 왔을 때만 생기는 것이라
 * 0건이면 감춘다 — 평소엔 없는 개념을 상시 노출할 이유가 없다.
 */
const FIXED_FILTERS: readonly TcVerdict[] = ['FAIL', 'RUNNING', 'PENDING', 'SUCCESS'];

type Filter = TcVerdict | 'ALL';

export function TcAgentResultList({
  rows,
  running,
  expectedTotal,
  separated,
}: {
  rows: readonly TcAgentRow[];
  /** 실행 중에는 진행 바 + "n/m 완료", 끝났으면 총 건수. */
  running: boolean;
  /** 확정 리소스 수 — 진행률의 분모. 0 이면 아직 모른다는 뜻이라 바를 감춘다. */
  expectedTotal: number;
  /** 위에 집계 계층이 실제로 있는가 — 없으면 구분선이 나눌 것도 없다. */
  separated: boolean;
}): ReactElement | null {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(0);

  if (rows.length === 0) return null;

  const { done, total } = runProgress(rows, expectedTotal);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  // 분모를 모르면 비율을 그릴 수 없다 — 받은 행 수로 100% 를 그리면 아직 보고하지
  // 않은 agent 가 없는 것처럼 보인다.
  const showBar = running && expectedTotal > 0;
  const waiting = Math.max(0, expectedTotal - rows.length);

  const counts = countAgentVerdicts(rows);
  const options = [
    { value: 'ALL' as const, label: `전체 ${rows.length}` },
    ...FIXED_FILTERS.map((verdict) => ({
      value: verdict,
      label: `${VERDICT_PILL[verdict].label} ${counts[verdict]}`,
    })),
    ...(counts.UNKNOWN > 0 ? [{ value: 'UNKNOWN' as const, label: `미확인 ${counts.UNKNOWN}` }] : []),
  ];

  const visible = sortAgentRows(
    filter === 'ALL' ? rows : rows.filter((row) => row.verdict === filter),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // 실행 중에는 행이 계속 늘어 마지막 페이지가 뒤로 밀린다 — 범위 밖으로 나간 페이지를
  // 그대로 쓰면 빈 화면이 된다.
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const first = visible.length === 0 ? 0 : safePage * PAGE_SIZE + 1;

  const changeFilter = (next: Filter): void => {
    setFilter(next);
    setPage(0);
  };

  return (
    // 구분선 + 넉넉한 여백이 "집계 → 목록" 의 단 경계다.
    <div className={separated ? 'mt-5 border-t border-[var(--pl-border)] pt-4' : 'mt-5'}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold text-[var(--pl-text-strong)]">Agent별 결과</p>
        <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          {running ? `${done}/${total} 완료` : `총 ${rows.length}건`}
        </p>
      </div>

      {/* 실행 중에만 — 끝난 실행에서 100% 바는 아무 것도 더 말해주지 않는다. */}
      {showBar && (
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--pl-gray-100)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="연결 테스트 진행"
        >
          <div
            className="h-full rounded-full bg-[var(--pl-primary)] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <SegControl
        className="mt-2.5"
        ariaLabel="판정 필터"
        options={options}
        value={filter}
        onChange={changeFilter}
      />

      {/* 8행 자리를 늘 확보한다 — 마지막 페이지가 3건이라고 카드가 줄면, 페이지를 넘길
          때마다 아래 표가 따라 움직인다. */}
      <div className="mt-1 min-h-[232px]">
        {pageRows.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[var(--pl-text-faint)]">
            {filter === 'ALL'
              ? 'agent 결과가 없습니다.'
              : `${VERDICT_PILL[filter].label} 상태인 agent 가 없습니다.`}
          </p>
        ) : (
          pageRows.map((row, index) => (
            <div
              key={`${row.resourceId}-${row.agentId ?? index}`}
              className="flex items-center gap-3 border-b border-[var(--pl-gray-100)] py-1.5 last:border-b-0"
            >
              <span
                className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--pl-text-medium)]"
                title={row.resourceId}
              >
                {resourceIdTail(row.resourceId)}
              </span>
              {/* 같은 리소스가 여러 줄일 때 둘을 가르는 유일한 값 — 폭을 고정해
                  이름 쪽 절단 위치가 행마다 흔들리지 않게 한다. */}
              <span className="w-[86px] flex-none truncate text-right font-mono text-[12px] text-[var(--pl-text-faint)]">
                {row.agentId ?? <Dash />}
              </span>
              {filter === 'ALL' && (
                <span className="flex w-[72px] flex-none justify-end">
                  <TcPill {...VERDICT_PILL[row.verdict]} />
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] tabular-nums text-[var(--pl-text-faint)]">
          {first}–{safePage * PAGE_SIZE + pageRows.length} / {visible.length}
          {/* 아직 한 줄도 올라오지 않은 몫 — 목록의 빈자리가 "없음"이 아니라 "대기"임을
              말하는 유일한 자리다. */}
          {running && waiting > 0 && ` · 응답 대기 ${waiting}건`}
        </p>
        {/* always — 한 페이지짜리 필터(실패 6건)에서 pager 가 사라지면 그만큼 카드가
            줄어, 칩을 누를 때마다 아래 표가 따라 움직인다. */}
        <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />
      </div>
    </div>
  );
}
