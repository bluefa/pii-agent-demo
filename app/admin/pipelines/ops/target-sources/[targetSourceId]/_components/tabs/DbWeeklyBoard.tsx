'use client';

/**
 * 논리 DB 주간 보드 — 1,500행의 상주지. 우측 오버레이 패널(ModalShell
 * variant='panel', 720px)의 콘텐츠로 산다: 본문에는 요약 라인만 남고, 밴드의 실패
 * 숫자·에이전트 표의 "DB 보기"·요약 라인 버튼이 프리셋과 함께 이 패널을 연다
 * (벤치마크 시안 A — Azure context pane 계열). 머리(제목+스코프 칩+닫기)는
 * flex-none, 본문이 자기 스크롤을 소유한다.
 *
 * 행 = databaseUri(이름은 있을 때만 윗줄 — URI 가 1급 정체성, P6), 7일 스트립,
 * 이번 주 판정, 마지막 성공. 진입은 filter-first: 검색 + 상태 칩(고정 슬롯,
 * TcAgentResultList 문법) 이 먼저 서고, 렌더는 페이지 단위(기본 20)라 1,500행이
 * DOM 에 한 번에 서지 않는다(P4).
 *
 *  - 범례(§2)는 툴바 우측 끝 — 실물 스와치(스트립과 같은 셀) + 한 단어. 칩이
 *    개수를, 범례가 색의 의미를 맡는다 (Grafana status history / GitHub 잔디 문법).
 *  - "이번 주" 열은 `succeededThisWeek` 원문 그대로 — 스트립에서 재계산하지 않는다
 *    (한 값 두 계산 함정, 시안 D 경계).
 *  - 정렬은 문제 우선(실패 → 그 외 → 미스케줄 → 진행 중 → 성공), bucket 안에서는
 *    wire 순서 유지.
 *  - 행 영역은 pageSize 만큼 floor 를 명시한다 — 마지막 페이지가 3건이라고 표가
 *    줄면 페이지를 넘길 때마다 pager 가 따라 움직인다.
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
  agentDisplayName,
  countBuckets,
  dayCellKind,
  dayCellTip,
  flattenDagRows,
  initialBoardFilter,
  scopeBoardRows,
  sortBoardRows,
  type BoardFilter,
  type DagDbRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** 2줄 정체성 행의 높이 근사 — floor 는 이 값 × pageSize 로 명시한다. */
const ROW_H = 59;

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
    ['run', '진행 중'],
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

/** 7일 스트립 — 셀 16px·간격 3px, 오늘(마지막 칸)만 링. 판정은 옆 pill 열이 지고
 *  색은 하루하루의 사실만 나른다. */
function DayStrip({ row }: { row: DagDbRow }): ReactElement {
  const last = row.db.days.length - 1;
  return (
    <span className="inline-flex items-center gap-[3px]">
      {row.db.days.map((day, i) => (
        <span
          key={day.day}
          title={dayCellTip(day)}
          className={cn(
            'h-4 w-4 rounded-[3px]',
            CELL_FILL[dayCellKind(day.status)],
            i === last && TODAY_RING,
          )}
        />
      ))}
    </span>
  );
}

export interface DbWeeklyBoardProps {
  data: DagStatusResponse;
  /** 진입 프리셋 — 없으면 헬스 판정에서 파생(UNHEALTHY+실패>0 → 실패 선적용). */
  initialFilter?: BoardFilter;
  initialAgentId?: string | null;
  /** 패널 머리의 ✕ — scrim·Esc 와 함께 ModalShell 의 onClose 로 모인다. */
  onClose: () => void;
}

export function DbWeeklyBoard({
  data,
  initialFilter,
  initialAgentId,
  onClose,
}: DbWeeklyBoardProps): ReactElement {
  const allRows = useMemo(() => flattenDagRows(data), [data]);
  const [agentId, setAgentId] = useState<string | null>(initialAgentId ?? null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BoardFilter>(
    () => initialFilter ?? initialBoardFilter(data.healthStatus, countBuckets(allRows)),
  );
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
    ...(counts.other > 0
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
        <h2 id="db-board-title" className={cn(opsStyles.cardTitle, 'flex items-baseline gap-2')}>
          논리 DB 주간 현황
          <span className="text-[16px] font-medium text-[var(--pl-text-weak)] tabular-nums">
            {allRows.length.toLocaleString('ko-KR')}
          </span>
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
            placeholder="databaseUri · 이름 검색"
            aria-label="논리 DB 검색"
            className={SEARCH_INPUT}
          />
          <SegControl ariaLabel="주간 판정 필터" options={options} value={filter} onChange={changeFilter} />
          <StripLegend />
        </div>

        {/* floor 명시 — 마지막 페이지가 짧아도, 칩을 실패↔전체로 오가도 pager 가 따라
            움직이지 않는다. 기준은 "이 스코프에서 어떤 칩을 눌러도 나올 수 있는 최대
            행수"(scoped, pageSize 상한): pageSize 그대로 깔면 3행짜리 대상에 20행의
            빈 벽이 선다. */}
        <div
          className="mt-2 overflow-x-auto"
          style={{ minHeight: Math.max(3, Math.min(pageSize, scoped.length)) * ROW_H }}
        >
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
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={`${row.agentId}:${row.db.databaseUri}`}>
                    {/* 720px 패널에서의 재배치 — 인라인(1,286px)의 420 은 과분하다. */}
                    <td className={cn(opsStyles.table.cell, 'max-w-[332px]')}>
                      {row.db.databaseName ? (
                        <>
                          <p className="truncate text-[14px] font-medium text-[var(--pl-text-strong)]">
                            {row.db.databaseName}
                          </p>
                          <p
                            className="truncate font-mono text-[12px] text-[var(--pl-text-weak)]"
                            title={row.db.databaseUri}
                          >
                            {row.db.databaseUri}
                          </p>
                        </>
                      ) : (
                        <>
                          {/* 이름이 아직 없으면 URI 가 1급 정체성으로 올라선다 (P6). */}
                          <p
                            className="truncate font-mono text-[14px] text-[var(--pl-text-strong)]"
                            title={row.db.databaseUri}
                          >
                            {row.db.databaseUri}
                          </p>
                          <p className="text-[12px] text-[var(--pl-text-weak)]">
                            이름 미확인 — Infra Manager 재배포 전
                          </p>
                        </>
                      )}
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] tabular-nums text-[var(--pl-text-weak)]">
            {first.toLocaleString('ko-KR')}–
            {(safePage * pageSize + pageRows.length).toLocaleString('ko-KR')} /{' '}
            {visible.length.toLocaleString('ko-KR')}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--pl-text-weak)]">
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
            {/* always — 한 페이지짜리 필터에서 pager 가 사라지면 그만큼 표가 준다. */}
            <OpsPagination page={safePage} totalPages={totalPages} onChange={setPage} always />
          </div>
        </div>
      </div>
    </section>
  );
}
