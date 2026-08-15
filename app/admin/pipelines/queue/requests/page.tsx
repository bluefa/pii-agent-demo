'use client';

/**
 * P2 연동 요청 목록 (/admin/pipelines/queue/requests) — design-spec §2.
 *
 * 탭 셋이 이 화면의 목차다 — 승인 대기·반려는 같은 요청을 상태로 자른 것이고, 전체
 * History 는 읽기 전용 기록이다. 전에는 카드 세 장이었다: 반폭 두 장이 나란히 서고 그
 * 아래 전폭 한 장. 셋 다 같은 17px 제목 + 건수 배지 + 설명 + 표라서 손대야 할 요청과
 * 손댈 필요 없는 기록이 같은 급으로 읽혔다(오너 지적 2026-08-15). 표면을 하나로 줄이면
 * 등급은 탭 하나가 만든다. 권한 요청(access/requests)이 같은 문제를 같은 방법으로 푼다.
 *
 * 탭이 제목이자 건수라서 카드 머리 줄이 없다 — 그리면 같은 이름과 같은 수가 한 화면에
 * 두 번 적힌다. 카드 크롬(테두리·그림자)도 없다: 탭 아래는 이미 한 장이다.
 *
 * 각 탭은 자기 소스를 자기 페이지로 읽는다(서버 page 파라미터, 0-based). 승인 대기·반려
 * 행은 같은 상세로 가고, 반려 사유 전문과 요청 리소스는 그곳에서 읽는다 — 목록은 한 줄
 * 미리보기만 한다. 기록은 기록이라 클릭되지 않는다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import Link from 'next/link';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { getApprovalHistory, getRequestList } from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

/** 5 rows is the body height the three tabs share (min-h-[360px]). */
const PAGE_SIZE = 5;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// Stable (module-level) section fetchers — one server page (0-based) each, so
// the useAbortableEffect deps stay identity-stable and never re-fire per render.
const fetchPending = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('PENDING', page, { ...opts, size: PAGE_SIZE });
const fetchRejected = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('REJECTED', page, { ...opts, size: PAGE_SIZE });
const fetchHistory = (page: number, opts: { signal: AbortSignal }): Promise<Paged<ApprovalHistoryRow>> =>
  getApprovalHistory(page, { ...opts, size: PAGE_SIZE });

interface PagedSection<T> {
  /** 0-based server page — same base as the pager, so nothing converts. */
  page: number;
  paged: Paged<T> | null;
  loading: boolean;
  error: unknown;
  setPage: (n: number) => void;
  reload: () => void;
}

/** One paginated section's data state. */
function usePagedSection<T>(
  fetcher: (page: number, opts: { signal: AbortSignal }) => Promise<Paged<T>>,
): PagedSection<T> {
  const [page, setPage] = useState(0);
  const [paged, setPaged] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return fetcher(page, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setPaged(result);
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [fetcher, page, retry],
  );

  return { page, paged, loading, error, setPage, reload: () => setRetry((n) => n + 1) };
}

const rq = {
  /** 16px — 이 문장이 화면이 먼저 말하는 사실이라 본문 급으로 올린다(오너 지시
   *  2026-08-15). 권한 요청(access)의 `pageDesc` 와 같은 값이다. */
  context: 'mt-1 text-[16px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',

  /**
   * 화면을 가르는 탭 레일 — 권한 요청(access/requests)의 `pageTabStrip`/`tab*` 과 같은
   * 값이다. 같은 어드민 안에서 승인 화면이 두 종류로 읽히면 안 된다.
   *
   * 16px 이라 카드 안의 line tab 보다 한 칸 크다: 이건 부품이 아니라 이 화면의 목차다.
   */
  tabStrip: 'mt-5 flex items-center gap-1 border-b border-[var(--pl-border)]',
  tab: 'flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[16px] transition-colors -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)]',
  tabIdle:
    'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-strong)] hover:border-[var(--pl-border-strong)]',
  /** 탭이 세는 수 — 탭이 곧 제목이므로 건수도 여기 붙는다(머리 줄엔 없다). */
  tabCount: 'text-[12px] font-semibold tabular-nums',

  /**
   * 탭 하나의 본문. 크롬이 없다 — 탭 아래는 이미 한 장이고, 거기에 카드를 얹으면
   * 표면이 두 겹이 된다.
   *
   * min-h 는 카드였을 때의 값을 그대로 쓴다. 탭마다 담기는 줄 수가 다르고(마지막 장은
   * 다섯 줄이 안 찬다) 안 잡아 두면 탭을 옮길 때마다 페이저가 오르내린다.
   */
  section: 'mt-4 flex min-h-[360px] flex-col',
  /** 14px — 권한 요청의 `a.desc` 와 같은 값. 16px 탭 바로 아래라 한 칸 내려가고,
   *  아래 12px 컬럼 머리와도 한 칸 벌어진다. */
  desc: 'text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[13px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',

  /**
   * Column widths — shared by a section's header row and its data rows.
   *
   * 승인 대기·반려는 SAME skeleton (service · code · cloud · note · when · tail) 을
   * 쓴다. 이제 둘이 나란히 서지 않고 탭으로 갈리지만 골격은 그대로 공유한다 — 다르면
   * 같은 요청이 탭 하나 건너 다른 표로 읽히고, 탭을 옮길 때 열이 제자리에 없다.
   * flex-1 컬럼 수까지 같아야 한다: `service` 와 `note` 가 둘 다 늘어난다.
   *
   * WIDTH BUDGET — 반폭 카드였을 때(1440 에서 카드 안쪽 536, 셸의 1080 바닥에서 356)
   * 잡은 예산이라 고정 열이 전부 TIGHT 하고 SHRINKABLE 하다(어디에도 `flex-none` 이
   * 없다). 전폭이 되면서 예산은 넉넉해질 뿐이라 그대로 둔다. Target #id 가 없는 것도
   * 그대로다 — 행이 이미 그 id 의 페이지로 가는 링크다.
   */
  service: 'min-w-0 flex-1 truncate',
  serviceName: 'font-medium text-[var(--pl-text-strong)]',
  code: 'w-[72px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  target: 'w-[56px] min-w-0 shrink truncate',
  cloud: 'w-[64px] min-w-0 shrink truncate',
  // 잘린 전문은 행을 눌러 상세에서 읽는다 — pointer-events-none 이라야 이 셀이
  // 행 링크 오버레이의 클릭을 가로채지 않는다.
  note: 'min-w-0 flex-1 truncate pointer-events-none',
  // 116 = 가장 긴 pill('연동 불가 확인': 6 한글 72 + 점 6 + gap 6 + 좌우 패딩 17)
  // 에 여유를 더한 값. truncate 는 그래도 남겨 둔다 — pill 은 원자적 박스라
  // 넘치면 옆 컬럼을 밀지 않고 그 위에 겹쳐 그려진다.
  status: 'w-[116px] min-w-0 shrink truncate',
  actor: 'w-[120px] min-w-0 shrink truncate',
  // 124 = 'YYYY-MM-DD HH:mm' at 13px tabular(≈110)에 여유. 좁히면 분 단위가
  // 조용히 잘려 나가므로 여유를 둔다. nowrap 이라 truncate 로 행을 지킨다.
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  chev: 'w-3.5 flex-none text-[var(--pl-text-faint)] group-hover:text-[var(--pl-primary)]',

  /** Loading bar inside a skeleton cell — same grammar as opsStyles.skeleton
   *  (task detail / 스캔 이력), sized down to a text line. */
  skeletonBar: 'h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  state: 'flex items-center gap-2 py-2.5 text-[13px] text-[var(--pl-text-weak)]',
  empty: 'flex flex-col items-center justify-center gap-0.5 py-9 text-center',
  emptyTitle: 'text-[13px] font-semibold text-[var(--pl-text-strong)]',
  emptyCaption: 'text-[12px] text-[var(--pl-text-weak)]',
  footer: 'mt-auto',
} as const;

/** One column of a section — its label and the width class its cells share.
 *  A column with no label is a tail slot (the › chevron): no header text, and
 *  no skeleton bar while loading. */
interface Column {
  label?: string;
  className: string;
}

/** 승인 대기·반려는 한 골격을 나눠 쓴다 — 같은 폭, 같은 flex-1 수. 설명/일자 라벨만
 *  갈린다. */
const actionColumns = (note: string, when: string): readonly Column[] => [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Cloud', className: rq.cloud },
  { label: note, className: rq.note },
  { label: when, className: rq.when },
  { className: rq.chev },
];

const PENDING_COLUMNS = actionColumns('설명', '요청 일자');
const REJECTED_COLUMNS = actionColumns('반려 사유', '반려 일자');

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Target', className: rq.target },
  { label: 'Cloud', className: rq.cloud },
  { label: '상태', className: rq.status },
  { label: '수행자', className: rq.actor },
  { label: '일시', className: rq.when },
];

interface TabSectionProps<T> {
  /** 화면에는 탭이 대신 말한다 — 여기 제목은 `aria-label` 로만 남는다. */
  title: string;
  desc: string;
  state: PagedSection<T>;
  /** Drives BOTH the header row and the loading skeleton, so the two can never
   *  drift from the widths the data rows use. */
  columns: readonly Column[];
  empty: { title: string; caption: string };
  children: (rows: T[]) => ReactNode;
}

/** 탭 하나의 본문 — 설명 / 컬럼 머리 / 본문 / 바닥에 고정된 페이저. */
function TabSection<T>({
  title,
  desc,
  state,
  columns,
  empty,
  children,
}: TabSectionProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = state;
  const rows = paged?.content ?? [];

  return (
    <section className={rq.section} aria-label={title}>
      <p className={rq.desc}>{desc}</p>

      {/* The rows are flex divs (a <tr> can't host the absolutely positioned
          row-link overlay reliably), so the table semantics are declared: a
          screen reader reads "서비스 코드: STL", not a bare "STL". Every branch
          below stays a row inside this table — including the message states. */}
      <div role="table" aria-label={`${title} 목록`}>
        <div className={rq.headRow} role="row">
          {columns.map((col) => (
            <span key={col.label ?? 'tail'} role="columnheader" className={col.className}>
              {col.label}
            </span>
          ))}
        </div>
        {error != null ? (
          <div role="row">
            <div role="cell" aria-colspan={columns.length} className={rq.state}>
              <span className="min-w-0 truncate">{errorMessage(error)}</span>
              <PlButton variant="secondary" size="sm" onClick={reload}>
                재시도
              </PlButton>
            </div>
          </div>
        ) : loading ? (
          // Skeleton drawing the table's own footprint (PAGE_SIZE rows in the
          // real column widths) — the section holds its size through the load.
          <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중">
            {Array.from({ length: PAGE_SIZE }, (_, row) => (
              <div key={row} className={rq.row} role="row" aria-hidden="true">
                {columns.map((col) => (
                  <span
                    key={col.label ?? 'tail'}
                    role="cell"
                    className={cn(col.className, col.label != null && rq.skeletonBar)}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div role="row">
            <div role="cell" aria-colspan={columns.length} className={rq.empty}>
              <span className={rq.emptyTitle}>{empty.title}</span>
              <span className={rq.emptyCaption}>{empty.caption}</span>
            </div>
          </div>
        ) : (
          children(rows)
        )}
      </div>

      <div className={rq.footer}>
        <OpsPagination
          page={page}
          totalPages={Math.max(1, paged?.totalPages ?? 1)}
          onChange={setPage}
          always
        />
      </div>
    </section>
  );
}

type RequestTab = 'pending' | 'rejected' | 'history';

export default function RequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);

  // 세 목록을 다 읽는다 — 안 보이는 탭의 건수를 탭 자신이 말해야 한다. 탭을 옮겨도
  // 다시 읽지 않으므로 진입 호출 수는 카드가 셋이던 때와 같다.
  const [tab, setTab] = useState<RequestTab>('pending');

  // 두 섹션이 모두 도착해야 합이 사실이다 — 하나라도 로딩 중이면 수를 말하지
  // 않는다(스켈레톤 옆에서 32px 볼드로 '0건'은 모르는 값을 아는 척하는 것).
  const counted = pending.paged != null && rejected.paged != null;
  const todo = (pending.paged?.totalElements ?? 0) + (rejected.paged?.totalElements ?? 0);

  const tabs: readonly { key: RequestTab; label: string; count: number | undefined }[] = [
    { key: 'pending', label: '승인 대기', count: pending.paged?.totalElements },
    { key: 'rejected', label: '반려', count: rejected.paged?.totalElements },
    { key: 'history', label: '전체 History', count: history.paged?.totalElements },
  ];

  return (
    <div>
      <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]">
        연동 요청
      </h1>
      <p className={rq.context}>
        서비스가 보낸 연동 승인 요청 중 확인이 필요한 건이 총
        {counted ? (
          <strong className={rq.contextTotal}>{todo}</strong>
        ) : (
          <span className={cn(rq.skeletonBar, 'mx-1 inline-block h-6 w-7 align-baseline')} />
        )}
        건 있어요
      </p>

      <div className={rq.tabStrip} role="tablist" aria-label="연동 요청 탭">
        {tabs.map(({ key, label, count }) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(key)}
              className={cn(rq.tab, on ? rq.tabActive : rq.tabIdle)}
            >
              {label}
              {/* 아직 모르는 수는 쓰지 않는다. */}
              {count != null && <span className={rq.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'pending' && (
        /* 승인 대기 — 행 전체가 상세로 가는 링크. */
        <TabSection
          title="승인 대기"
          desc="승인이 필요한 연동 요청이에요 — 검토 후 승인하거나 반려해 주세요"
          state={pending}
          empty={{
            title: '승인을 기다리는 요청이 없어요',
            caption: '새 연동 요청이 들어오면 여기에 표시돼요',
          }}
          columns={PENDING_COLUMNS}
        >
          {(rows) =>
            rows.map((row) => {
              const id = row.targetSourceId;
              return (
                <div
                  key={id ?? row.serviceCode}
                  role="row"
                  className={cn(rq.row, id != null && rq.rowLink)}
                >
                  {/* 링크는 첫 셀 안에 둔다 — role=row 는 셀만 자식으로 가져야
                      해서, 행 직속 <a> 는 스크린리더 순회에서 지워질 수 있다.
                      absolute inset-0 이라 위치는 그대로 행 전체를 덮는다. */}
                  <span role="cell" className={cn(rq.service, rq.serviceName)}>
                    {id != null && (
                      <Link
                        href={passRoutes.pipelines.queue.request(id)}
                        aria-label={`${row.serviceName ?? `Target Source ${id}`} 연동 요청 상세 보기`}
                        className="absolute inset-0"
                      />
                    )}
                    {row.serviceName ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.code, rq.mono)}>
                    {row.serviceCode ?? '—'}
                  </span>
                  <span role="cell" className={rq.cloud}>
                    <ProvTag provider={row.cloudProvider ?? ''} />
                  </span>
                  <span role="cell" className={rq.note}>
                    {row.description ?? '—'}
                  </span>
                  <span role="cell" className={rq.when}>
                    {fmtDateTime(row.latestApprovalRequest?.requestedAt)}
                  </span>
                  <span role="cell" className={rq.chev}>
                    <Icon name="arrow-up-right" size="sm" />
                  </span>
                </div>
              );
            })
          }
        </TabSection>
      )}

      {tab === 'rejected' && (
        /* 반려 — 승인 대기와 같은 컬럼 골격. 반려 사유가 설명 자리(유일한 두 번째 flex
           컬럼)에 들어간다. 행은 같은 상세로 가고, 사유 전문과 요청 내역(리소스)은
           그곳에서 읽는다. */
        <TabSection
          title="반려"
          desc="반려했으나 서비스 측 담당자가 아직 확인하지 않았어요 — 행을 눌러 사유와 요청 내역을 볼 수 있어요"
          state={rejected}
          empty={{
            title: '확인 대기 중인 반려 건이 없어요',
            caption: '반려 처리한 요청이 여기에 모여요',
          }}
          columns={REJECTED_COLUMNS}
        >
          {(rows) =>
            rows.map((row) => {
              const id = row.targetSourceId;
              return (
                <div
                  key={id ?? row.serviceCode}
                  role="row"
                  className={cn(rq.row, id != null && rq.rowLink)}
                >
                  <span role="cell" className={cn(rq.service, rq.serviceName)}>
                    {id != null && (
                      <Link
                        href={passRoutes.pipelines.queue.request(id)}
                        aria-label={`${row.serviceName ?? `Target Source ${id}`} 반려 내역 상세 보기`}
                        className="absolute inset-0"
                      />
                    )}
                    {row.serviceName ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.code, rq.mono)}>
                    {row.serviceCode ?? '—'}
                  </span>
                  <span role="cell" className={rq.cloud}>
                    <ProvTag provider={row.cloudProvider ?? ''} />
                  </span>
                  {/* 미리보기 한 줄. 전문은 행을 눌러 상세에서 — hover 툴팁은
                      두지 않는다: 툴팁을 띄우려면 이 셀이 포인터를 받아야 하고,
                      그러면 같은 자리에서 행 링크 클릭이 죽는다. */}
                  <span role="cell" className={rq.note}>
                    {row.latestApprovalRequest?.reason ?? '—'}
                  </span>
                  <span role="cell" className={rq.when}>
                    {fmtDateTime(row.latestApprovalRequest?.processedAt)}
                  </span>
                  <span role="cell" className={rq.chev}>
                    <Icon name="arrow-up-right" size="sm" />
                  </span>
                </div>
              );
            })
          }
        </TabSection>
      )}

      {tab === 'history' && (
        /* 전체 History (approval-history) — 읽기 전용 감사 로그. key 는
           historyRecordId (유일). targetSourceId·requestId 는 반복될 수 있어 key 로
           못 쓴다. */
        <TabSection
          title="전체 History"
          desc="모든 연동 요청의 승인 처리 이력이에요"
          state={history}
          empty={{
            title: '표시할 승인 이력이 없어요',
            caption: '연동 요청이 처리되면 이력이 여기에 쌓여요',
          }}
          columns={HISTORY_COLUMNS}
        >
          {(rows) =>
            rows.map((row) => (
              <div
                key={row.historyRecordId ?? `${row.targetSourceId}:${row.requestId}`}
                role="row"
                className={rq.row}
              >
                <span role="cell" className={cn(rq.service, rq.serviceName)}>
                  {row.serviceName ?? '—'}
                </span>
                <span role="cell" className={cn(rq.code, rq.mono)}>
                  {row.serviceCode ?? '—'}
                </span>
                <span role="cell" className={cn(rq.target, rq.mono)}>
                  {row.targetSourceId != null ? `#${row.targetSourceId}` : '—'}
                </span>
                <span role="cell" className={rq.cloud}>
                  <ProvTag provider={row.cloudProvider ?? ''} />
                </span>
                <span role="cell" className={rq.status}>
                  <HistoryStatusPill status={row.status} />
                </span>
                <span role="cell" className={rq.actor}>
                  {row.actorId ?? '—'}
                </span>
                <span role="cell" className={rq.when}>
                  {fmtDateTime(row.createdAt)}
                </span>
              </div>
            ))
          }
        </TabSection>
      )}
    </div>
  );
}
