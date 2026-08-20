'use client';

/**
 * 논리 DB 주간 보드 — 1,500행의 상주지. 우측 오버레이 패널(ModalShell
 * variant='panel', 960px)의 콘텐츠로 산다: 본문에는 요약 라인만 남고, 밴드의 실패
 * 숫자·에이전트 표의 "DB 보기"·요약 라인 버튼이 프리셋과 함께 이 패널을 연다
 * (벤치마크 시안 A — Azure context pane 계열). 머리(제목+스코프 칩+닫기)는
 * flex-none, 본문이 자기 스크롤을 소유한다.
 *
 * 행 = 정체성(Database·Schema 라벨 2줄 — 스키마가 없는 행은 라벨째 접힌다),
 * 7일 스트립, 이번 주 판정, 마지막 성공, DAG. 진입은 filter-first: 검색 + 상태 칩(고정 슬롯,
 * TcAgentResultList 문법) 이 먼저 서고, 렌더는 페이지 단위(기본 20)라 1,500행이
 * DOM 에 한 번에 서지 않는다(P4).
 *
 *  - 범례(§2)는 툴바 우측 끝 — 실물 스와치(스트립과 같은 셀) + 한 단어. 칩이
 *    개수를, 범례가 색의 의미를 맡는다 (Grafana status history / GitHub 잔디 문법).
 *  - "이번 주" 열은 `succeededThisWeek` 원문 그대로 — 스트립에서 재계산하지 않는다
 *    (한 값 두 계산 함정, 시안 D 경계).
 *  - 정렬은 문제 우선(실패 → 그 외 → 미스케줄 → 실행 시작 → 성공), bucket 안에서는
 *    wire 순서 유지.
 *  - pager 는 고정 푸터(flex-none border-t) — 카드들의 OpsPagination 을 중앙
 *    정렬 그대로 쓰고, 행수·필터와 무관하게 패널 바닥에 남는다. 그래서 행 영역
 *    floor 가 필요 없다.
 *  - 필터·검색·스코프·페이지 크기가 바뀌면 페이지는 0 으로 — 페이지 번호는 목록보다
 *    오래 살면 안 된다.
 *  - 셀 툴팁은 native title: 날짜·상태·successTime(성공한 날에만). 같은 정보(이번
 *    주·마지막 성공)가 행 열에 이미 있으므로 hover 는 보조 채널이다.
 *  - 진입 프리셋(initialFilter·initialAgentId)은 마운트 시 1회만 읽는다 — 패널이
 *    닫히면 언마운트되므로(ModalShell) 매 오픈이 새 마운트고, 이후 조작은 전부
 *    보드 내부 상태다.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { DagStatusResponse } from '@/lib/types/dag-status';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { SegControl } from '@/app/admin/pipelines/_components/SegControl';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import {
  BUCKET_LABEL,
  FIXED_BOARD_FILTERS,
  abbrevDagName,
  agentDisplayName,
  countBuckets,
  dayCellKind,
  dayCellTip,
  flattenDagRows,
  isTodayKst,
  scopeBoardRows,
  sortBoardRows,
  type BoardFilter,
  type DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** ConfirmedInfoCard 의 검색 인풋 — 같은 화면의 같은 조작이라 같은 옷. */
const SEARCH_INPUT =
  'h-8 w-[260px] flex-none rounded-lg border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] px-3 text-[14px] text-[var(--pl-text-strong)] focus:border-[var(--pl-primary)] focus:shadow-[0_0_0_3px_var(--pl-primary-ring)] focus:outline-none';

const CELL_FILL: Record<ReturnType<typeof dayCellKind>, string> = {
  ok: 'bg-[var(--pl-ok)]',
  fail: 'bg-[var(--pl-err)]',
  run: 'bg-[var(--pl-warn)]',
  none: 'bg-[var(--pl-gray-100)]',
  // 계약 밖의 값 — 부재(면)와도 상태(색)와도 다른, 획만 있는 셀.
  unknown: 'border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)]',
};

/** 오늘(마지막 칸) 링 — 스트립과 범례가 같은 표기를 쓴다. */
const TODAY_RING = 'ring-1 ring-[var(--pl-gray-400)] ring-offset-1';

/** 색 범례 — 실물 스와치(스트립과 같은 16px 셀) + 한 단어. 라벨은 UI 어휘만
 *  (wire enum 은 셀 툴팁 채널의 것). 오늘은 색이 아니라 링이므로 부재색 위에 링. */
function StripLegend(): ReactElement {
  const items: ReadonlyArray<[keyof typeof CELL_FILL, string]> = [
    ['ok', '성공'],
    ['fail', '실패'],
    ['run', '실행 시작'],
    ['none', '스케줄 없음'],
    ['unknown', '판정 불가'],
  ];
  return (
    <span className="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--pl-text-weak)]">
      {items.map(([kind, label]) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('h-4 w-4 rounded-[3px]', CELL_FILL[kind])} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn('h-4 w-4 rounded-[3px]', CELL_FILL.none, TODAY_RING)} />
        오늘
      </span>
    </span>
  );
}

/** 7일 스트립 — 셀 16px·간격 3px, 오늘 칸만 링(자리가 아니라 날짜로 고른다).
 *  판정은 옆 pill 열이 지고 색은 하루하루의 사실만 나른다. DAG 상세 모달도 같은
 *  스트립을 쓴다 — 같은 사실을 두 벌로 그리지 않는다. */
export function DayStrip({ row }: { row: DagDbRow }): ReactElement {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {row.db.days.map((day) => (
        <span
          key={day.day}
          title={dayCellTip(day)}
          className={cn(
            'h-4 w-4 rounded-[3px]',
            CELL_FILL[dayCellKind(day.status)],
            isTodayKst(day.day) && TODAY_RING,
          )}
        />
      ))}
    </span>
  );
}

/** 행 정체성 — Database 와 Schema 를 각자 라벨을 달고 선다. MySQL 처럼 둘이
 *  같은 값인 엔진이 있어서(스키마=데이터베이스) 라벨 없이 두 줄을 쌓으면 같은 값이
 *  두 번 찍힌 것처럼 읽힌다. 주소(databaseUri)는 서버를 아는 유일한 값이라 버리지
 *  않고 툴팁으로 내린다 — 검색은 그대로 주소도 훑는다. */
function DbIdentity({ db }: { db: DagDbRow['db'] }): ReactElement {
  return (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2" title={db.databaseUri}>
      <span className="text-[12px] text-[var(--pl-text-weak)]">Database</span>
      <span className="truncate text-[14px] font-medium text-[var(--pl-text-strong)]">
        {db.databaseName ?? <Dash />}
      </span>
      {/* 스키마가 없으면 라벨째 접는다 — 빈 자리를 대시로 채우면 없는 값이 행마다
          한 줄씩 자리를 차지한다. */}
      {db.schemaName && (
        <>
          <span className="text-[12px] text-[var(--pl-text-weak)]">Schema</span>
          <span className="truncate text-[12px] text-[var(--pl-text-medium)]">{db.schemaName}</span>
        </>
      )}
    </span>
  );
}

export interface DbWeeklyBoardProps {
  data: DagStatusResponse;
  /** 진입 프리셋 — 진입 세 곳이 각자 약속한 것을 명시한다(실패 숫자만 'failed',
   *  나머지는 'ALL'). 기본값을 두지 않는 것이 규칙이다: 여는 쪽이 무엇을 보여 주기로
   *  했는지 알지, 보드가 추측할 일이 아니다. */
  initialFilter: BoardFilter;
  initialAgentId?: string | null;
  /** 패널 머리의 ✕ — scrim·Esc 와 함께 ModalShell 의 onClose 로 모인다. */
  onClose: () => void;
  /** DAG 이름 클릭 — 상세 모달은 패널 밖(ApprovalTab)에서 열린다: 패널 위에 겹치는
   *  레이어라 Esc 를 누가 먹을지 부모가 알아야 한다. */
  onOpenDag: (row: DagDbRow) => void;
}

export function DbWeeklyBoard({
  data,
  initialFilter,
  initialAgentId,
  onClose,
  onOpenDag,
}: DbWeeklyBoardProps): ReactElement {
  const allRows = useMemo(() => flattenDagRows(data), [data]);
  const [agentId, setAgentId] = useState<string | null>(initialAgentId ?? null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BoardFilter>(initialFilter);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // 칩 카운트의 분모는 스코프(에이전트+검색)까지 — 검색이 숨긴 12건을 "실패 14"로
  // 세면 칩과 목록이 서로 다른 말을 한다.
  const scoped = useMemo(
    () => scopeBoardRows(allRows, agentId, query),
    [allRows, agentId, query],
  );
  const counts = useMemo(() => countBuckets(scoped), [scoped]);
  const visible = useMemo(
    () => sortBoardRows(filter === 'ALL' ? scoped : scoped.filter((r) => r.bucket === filter)),
    [scoped, filter],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const first = visible.length === 0 ? 0 : safePage * pageSize + 1;

  const options = [
    ...FIXED_BOARD_FILTERS.map((bucket) => ({
      value: bucket as BoardFilter,
      label: `${BUCKET_LABEL[bucket]} ${counts[bucket].toLocaleString('ko-KR')}`,
    })),
    // 'other' 는 계약 밖 값이 실제로 왔을 때만 생기는 칩이지만, 걸려 있는 동안에는
    // 0건이어도 남는다 — 사라지면 보이지 않는 필터가 목록을 비운 채로 남는다.
    ...(counts.other > 0 || filter === 'other'
      ? [{ value: 'other' as BoardFilter, label: `그 외 ${counts.other.toLocaleString('ko-KR')}` }]
      : []),
    { value: 'ALL' as BoardFilter, label: `전체 ${scoped.length.toLocaleString('ko-KR')}` },
  ];

  const changeFilter = (next: BoardFilter): void => {
    setFilter(next);
    setPage(0);
  };
  const changeQuery = (next: string): void => {
    setQuery(next);
    setPage(0);
  };
  const clearAgent = (): void => {
    setAgentId(null);
    setPage(0);
  };
  const changePageSize = (next: number): void => {
    setPageSize(next);
    setPage(0);
  };

  const scopeAgent = agentId ? data.agents.find((a) => a.agentId === agentId) : undefined;

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="논리 DB 주간 현황">
      {/* 패널 머리 — 제목·스코프 칩·닫기(✕·scrim·Esc 가 전부 같은 onClose).
          본문이 스크롤해도 이 줄은 남는다. */}
      <div className="flex flex-none items-center justify-between gap-3 border-b border-[var(--pl-border)] px-6 py-4">
        {/* 제목에 총계를 달지 않는다 — 스코프가 걸리면 그 숫자만 혼자 전체를 말해서
            바로 아래 '전체' 칩과 어긋난다. 개수는 칩과 푸터 범위가 진다. */}
        <h2 id="db-board-title" className={opsStyles.cardTitle}>
          논리 DB 주간 현황
        </h2>
        <div className="flex flex-none items-center gap-3">
          {/* 스코프가 보이지 않는 필터가 되지 않도록 — 걸려 있으면 이 칩이 유일하게 말한다. */}
          {scopeAgent ? (
            <span className={cn(opsStyles.tag, 'gap-1.5')}>
              에이전트 {agentDisplayName(scopeAgent.resourceId)}
              <button
                type="button"
                aria-label="에이전트 필터 해제"
                onClick={clearAgent}
                className="cursor-pointer font-semibold text-[var(--pl-text-weak)] hover:text-[var(--pl-text-strong)]"
              >
                ×
              </button>
            </span>
          ) : (
            <span className="text-[12px] text-[var(--pl-text-weak)]">
              에이전트 전체 {data.agents.length.toLocaleString('ko-KR')}개
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="패널 닫기"
            title="닫기 (Esc)"
            className="inline-grid h-8 w-8 place-items-center rounded-md text-[var(--pl-text-weak)] transition-colors hover:bg-[var(--pl-gray-100)] hover:text-[var(--pl-text-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-primary)]"
          >
            <Icon name="x" size="sm" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="이름 · 스키마 · DAG · 주소 검색"
            aria-label="논리 DB 검색"
            className={SEARCH_INPUT}
          />
          <SegControl ariaLabel="주간 판정 필터" options={options} value={filter} onChange={changeFilter} />
          <StripLegend />
        </div>

        {/* pager 가 고정 푸터로 내려갔으므로 floor 가 필요 없다 — 짧은 페이지는
            그냥 짧게 끝나고, 푸터는 행수와 무관하게 패널 바닥에 있다. */}
        <div className="mt-2 overflow-x-auto">
          {pageRows.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-[var(--pl-text-weak)]">
              조건에 맞는 논리 DB가 없어요.
            </p>
          ) : (
            <table className={opsStyles.table.base}>
              <thead>
                <tr>
                  <th className={opsStyles.table.headCell}>논리 DB</th>
                  <th className={opsStyles.table.headCell}>최근 7일 ({data.timezone})</th>
                  <th className={opsStyles.table.headCell}>이번 주</th>
                  <th className={opsStyles.table.headCell}>마지막 성공</th>
                  <th className={opsStyles.table.headCell}>DAG</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={`${row.agentId}:${row.db.databaseUri}`}>
                    <td className={cn(opsStyles.table.cell, 'max-w-[280px]')}>
                      <DbIdentity db={row.db} />
                    </td>
                    <td className={opsStyles.table.cell}>
                      <DayStrip row={row} />
                    </td>
                    <td className={opsStyles.table.cell}>
                      {row.db.succeededThisWeek ? (
                        <TcPill tone="ok" label="성공" />
                      ) : (
                        <TcPill tone="err" label="성공 없음" />
                      )}
                    </td>
                    <td className={cn(opsStyles.table.cell, 'whitespace-nowrap font-mono text-[12px] tabular-nums')}>
                      {row.db.lastSuccessAt ? fmtDateTime(row.db.lastSuccessAt) : <Dash />}
                    </td>
                    {/* DAG 는 행을 실행하는 주체의 이름 — 판정이 아니라 참조라 오른쪽
                        끝, 흐린 mono. 이름이 없는 행은 대시 대신 말로(대시는 "칸이
                        비었다"까지만 말한다), 그리고 그 행도 열린다: 주소 조회의 키는
                        dagName 이 아니라 databaseUri 라서 물어볼 것이 남아 있다. */}
                    <td className={cn(opsStyles.table.cell, 'max-w-[200px]')}>
                      <button
                        type="button"
                        onClick={() => onOpenDag(row)}
                        title={row.db.dagName ?? '이 논리 DB 를 실행한 DAG 가 응답에 없어요'}
                        // 접근 이름에 보이는 이름을 먼저 싣는다 — "DAG 상세 열기" 하나만
                        // 두면 한 페이지의 스무 버튼이 전부 같은 이름으로 불리고, 보이는
                        // 이름으로는 부를 수 없게 된다.
                        aria-label={`${row.db.dagName ? abbrevDagName(row.db.dagName) : '실행 기록 없음'} DAG 상세 열기`}
                        className={cn(
                          'block w-full cursor-pointer truncate text-left text-[12px] text-[var(--pl-text-weak)] hover:text-[var(--pl-text-strong)] hover:underline',
                          row.db.dagName && 'font-mono',
                        )}
                      >
                        {row.db.dagName ? abbrevDagName(row.db.dagName) : '실행 기록 없음'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* 고정 푸터 — pager 는 이 화면 카드들의 OpsPagination 그대로(중앙 정렬,
          32px 버튼). 행수·필터가 바뀌어도 이 줄은 패널 바닥에서 움직이지 않는다.
          mt-4 는 카드 본문용 간격이라 푸터에서는 0 으로 되돌린다. */}
      <div className="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-[var(--pl-border)] px-6 py-3 [&>nav]:mt-0">
        <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
          {first.toLocaleString('ko-KR')}–
          {(safePage * pageSize + pageRows.length).toLocaleString('ko-KR')} /{' '}
          {visible.length.toLocaleString('ko-KR')}
        </p>
        {/* always — 한 페이지짜리 필터에서도 푸터 높이가 흔들리지 않는다. */}
        <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />
        <label className="flex items-center justify-self-end gap-1.5 text-[12px] text-[var(--pl-text-weak)]">
          페이지당
          <PlSelect
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            aria-label="페이지당 행 수"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </PlSelect>
        </label>
      </div>
    </section>
  );
}
