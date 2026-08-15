'use client';

/**
 * P2 연동 요청 (/admin/pipelines/queue/requests) — 승인 워크벤치.
 *
 * 화면이 목록이 아니라 승인함이다. 왼쪽에서 요청을 고르고 오른쪽에서 요청 내역(연동 대상
 * 리소스)을 읽고 그 자리에서 승인·반려한다. 전에는 카드 세 장에 링크 다섯 줄이 있었고,
 * 요청 하나를 보려면 상세 페이지로 나갔다가 목록으로 돌아와야 했다 — 큐를 훑는 일이 매번
 * 화면 두 번 이동이었다(오너 지시 2026-08-15).
 *
 * 탭 셋이 이 화면의 목차다 — 승인 대기·반려는 같은 요청을 상태로 자른 것이고 전체 History
 * 는 읽기 전용 기록이다. 셋 다 같은 17px 제목 + 건수 배지 + 표를 가진 카드였을 때는 손대야
 * 할 요청과 손댈 필요 없는 기록이 같은 급으로 읽혔다.
 *
 * 권한 요청(access/requests)이 같은 문제를 같은 방법으로 푼다 — 탭 수치도 워크벤치 수치도
 * 그쪽 `accessStyles` 와 같은 값이다. 지금은 각자 선언한다: 그쪽은 아직 안 머지된
 * 브랜치(#709)라 파일을 옮기면 두 브랜치가 부딪친다. #709 가 들어오면 `_components/` 로
 * 한 번에 올린다.
 *
 * 상세 라우트(`requests/[targetSourceId]`)는 그대로 둔다 — 알림·딥링크가 오는 자리다.
 * 시트와 그 라우트는 같은 `RequestDetail` 을 그린다.
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';

import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { RequestDetail } from '@/app/admin/pipelines/queue/requests/_components/RequestDetail';
import { getApprovalHistory, getRequestList } from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

/** 레일 한 장에 담는 요청 수. */
const PAGE_SIZE = 5;

/**
 * 이력만 한 장에 8줄이다.
 *
 * 이 탭은 고르는 목록이 아니라 읽는 기록이고, 줄 하나가 이벤트 하나라 훑는 단위가 크다.
 * 왼쪽 레일이 없는 탭이라 세로 여유도 여기만 있다(권한 요청 이력과 같은 판단).
 */
const HISTORY_PAGE_SIZE = 8;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// Stable (module-level) section fetchers — one server page (0-based) each, so
// the useAbortableEffect deps stay identity-stable and never re-fire per render.
const fetchPending = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('PENDING', page, { ...opts, size: PAGE_SIZE });
const fetchRejected = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('REJECTED', page, { ...opts, size: PAGE_SIZE });
const fetchHistory = (page: number, opts: { signal: AbortSignal }): Promise<Paged<ApprovalHistoryRow>> =>
  getApprovalHistory(page, { ...opts, size: HISTORY_PAGE_SIZE });

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
          // 서 있던 페이지가 사라졌으면 마지막 장으로 물러난다 — 승인·반려가 목록을
          // 짧게 만드는 화면이라, 그냥 두면 탭은 "4건"인데 레일은 빈 상태가 된다.
          const last = Math.max(result.totalPages - 1, 0);
          if (page > last) {
            setPage(last);
            return;
          }
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

  const reload = useCallback(() => setRetry((n) => n + 1), []);
  return { page, paged, loading, error, setPage, reload };
}

const rq = {
  pageTitle: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 16px — 이 문장이 화면이 먼저 말하는 사실이라 본문 급으로 올린다(오너 지시
   *  2026-08-15). 권한 요청의 `pageDesc` 와 같은 값이다. */
  context: 'mt-1 text-[16px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',

  /** 화면을 가르는 탭 레일 — 16px 이라 카드 안의 line tab 보다 한 칸 크다: 이건 부품이
   *  아니라 이 화면의 목차다. */
  tabStrip: 'mt-5 flex items-center gap-1 border-b border-[var(--pl-border)]',
  tab: 'flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[16px] transition-colors -mb-px',
  tabActive: 'font-semibold text-[var(--pl-primary)] border-[var(--pl-primary)]',
  tabIdle:
    'font-medium text-[var(--pl-text-weak)] border-transparent hover:text-[var(--pl-text-strong)] hover:border-[var(--pl-border-strong)]',
  /** 탭이 세는 수 — 탭이 곧 제목이므로 건수도 여기 붙는다. */
  tabCount: 'text-[12px] font-semibold tabular-nums',

  /**
   * 승인 워크벤치 — 왼쪽 대기 목록, 오른쪽 고른 요청 하나.
   *
   * 바닥이 캔버스(#F4F4FB)인 것이 이 블록의 전부다. 흰 카드는 어드민 기본 바닥
   * (#F9FAFB) 위에서 ΔE00 1.20 — JND 아래라 테두리 혼자 버틴다. 같은 흰 면이 캔버스
   * 위에서는 4.12 로 읽힌다. 카드를 덜 희게 만들 수 없으면 바닥을 내린다.
   *
   * 높이는 뷰포트까지 — 워크벤치는 카드가 아니라 이 화면의 작업면이다. 282 = 상단 내비
   * 64 + main 상단 여백 24 + 제목·판정 문장·탭 146 + 바닥 48.
   *
   * 레일 236 은 권한 요청의 352 가 아니라 서비스별 NLB 배정 모달(ServiceAssignmentModal)
   * 의 레일 폭이다(오너 지시 2026-08-15). 이 시트가 담는 것이 저쪽과 다르다 — 권한 요청
   * 시트는 사실 셋과 사유 한 문단이라 폭이 남지만, 여기 시트에는 971px 짜리 연동 대상
   * 표가 들어간다. 레일에서 덜어낸 116 이 그대로 그 표의 열이 된다.
   */
  bench: `mt-4 grid min-h-[calc(100vh-282px)] grid-cols-[236px_1fr] overflow-hidden rounded-[12px] ${serviceSidebarStyles.canvas}`,
  /** 레일은 헤어라인이 아니라 간격으로 끊는다 — 표가 아니라 요청 더미로 읽히게. 왼쪽이
   *  더 좁은 것은 캔버스 가장자리가 아무것도 가르지 않기 때문이다(그 폭이 곧 카드에서
   *  빠지는 폭). 오른쪽 6은 레일과 시트 사이를 혼자 만든다 — 시트는 `ml-0` 이다. */
  benchList: 'flex flex-col py-6 pl-4 pr-6',
  benchRows: 'flex flex-col gap-1.5',
  benchFooter: 'mt-auto pt-2',
  benchItem:
    'flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border bg-[var(--pl-bg-card)] px-3 py-2.5 text-left transition-colors',
  benchItemIdle: 'border-[var(--pl-border)] hover:border-[var(--pl-border-strong)]',
  /** 고른 항목은 테두리와 안쪽 막대 둘 다 — 테두리만으로는 캔버스 위에서 약하다. */
  benchItemActive:
    'border-[var(--pl-primary)] shadow-[inset_3px_0_0_var(--pl-primary)] bg-[var(--pl-primary-bg)]',
  benchItemStack: 'flex min-w-0 flex-1 flex-col gap-0.5',
  /** 서비스 이름 16px — 이 카드에서 고르는 것은 서비스이고, 코드·Provider·경과는 그걸
   *  고르고 나서 읽는 값이다. */
  benchItemName: 'truncate text-[16px] font-semibold text-[var(--pl-text-strong)]',
  benchItemNameActive: 'truncate text-[16px] font-semibold text-[var(--pl-primary)]',
  /** 코드 · Provider · 대기 경과가 한 줄이다. 236 레일에서 경과를 이름과 같은 줄에 두면
   *  pill 이 40px 을 가져가고 남는 폭이 이름을 자른다 — 서비스 이름이 이 카드에서 고르는
   *  것 자체라 잘리면 안 된다. 아랫줄은 12px 셋이라 pill 이 끝에 서도 이름을 안 건드린다. */
  benchItemMeta: 'flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--pl-text-weak)]',
  benchItemCode: 'truncate [font-family:var(--pl-font-mono)]',
  /** 대기 경과 — 기록이 못 하는 말이라 큐만 쓴다. 임계를 넘으면 잉크가 바뀐다.
   *  `ml-auto` 라 코드·Provider 가 짧든 길든 줄 끝에 선다. */
  benchWait:
    'ml-auto flex-none rounded-full bg-[var(--pl-gray-100)] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]',
  benchWaitHot:
    'ml-auto flex-none rounded-full bg-[var(--pl-warn-bg)] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-warn-text)]',
  /** 목록 자리의 스켈레톤 타일 — `skeletonBar` 는 h-3.5 라 여기 못 쓴다(`cn` 은 단순
   *  join 이라 h-3.5 와 h-7 을 같이 주면 Tailwind 출력 순서가 이긴다). */
  benchSkelTile: 'h-7 w-7 flex-none animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  /** 오른쪽 시트 — 바깥 24 · 안쪽 세로 24 · 안쪽 가로 20.
   *
   *  권한 요청 시트는 36/32 다. 여기는 한 단씩 좁힌다: 이 시트의 가장 넓은 내용이 971px
   *  고정 표라서, 가로 패딩 1px 이 그대로 표에서 빠지는 1px 이다. 가로만 한 칸 더 좁은
   *  이유도 그것이다 — 세로는 아무것도 밀어내지 않는다. */
  benchPane:
    'm-6 ml-0 overflow-y-auto rounded-[9px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] px-5 py-6',

  /** 이력 탭 — 레일이 없으니 표 한 장이 탭을 통째로 쓴다. 크롬은 없다: 탭 아래는 이미
   *  한 장이고, 거기에 카드를 얹으면 표면이 두 겹이 된다. */
  section: 'mt-4 flex flex-col',
  desc: 'text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)]',

  /** 이력 표의 컬럼 폭 — 머리 행·스켈레톤·데이터 행이 함께 쓴다. 어디에도 `flex-none`
   *  이 없다: 셸의 1080 바닥에서 고정 셀이 먼저 양보하고 표 밖으로 그려지지 않는다. */
  service: 'min-w-0 flex-1 truncate',
  serviceName: 'font-medium text-[var(--pl-text-strong)]',
  code: 'w-[72px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  target: 'w-[56px] min-w-0 shrink truncate',
  cloud: 'w-[64px] min-w-0 shrink truncate',
  // 116 = 가장 긴 pill('연동 불가 확인': 6 한글 72 + 점 6 + gap 6 + 좌우 패딩 17)
  // 에 여유를 더한 값. truncate 는 그래도 남겨 둔다 — pill 은 원자적 박스라
  // 넘치면 옆 컬럼을 밀지 않고 그 위에 겹쳐 그려진다.
  status: 'w-[116px] min-w-0 shrink truncate',
  actor: 'w-[120px] min-w-0 shrink truncate',
  // 124 = 'YYYY-MM-DD HH:mm' at 14px tabular(≈118)에 여유. 좁히면 분 단위가
  // 조용히 잘려 나가므로 여유를 둔다. nowrap 이라 truncate 로 행을 지킨다.
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',

  skeletonBar: 'h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  state: 'flex items-center gap-2 py-2.5 text-[14px] text-[var(--pl-text-weak)]',
  empty: 'flex flex-col items-center justify-center gap-0.5 py-9 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyCaption: 'text-[12px] text-[var(--pl-text-weak)]',
  footer: 'mt-auto',
} as const;

/** 이력 표 한 컬럼의 라벨과 셀들이 공유하는 폭 클래스. */
interface Column {
  label: string;
  className: string;
}

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Target', className: rq.target },
  { label: 'Cloud', className: rq.cloud },
  { label: '상태', className: rq.status },
  { label: '수행자', className: rq.actor },
  { label: '일시', className: rq.when },
];

type RequestTab = 'pending' | 'rejected' | 'history';

/**
 * 며칠부터 "오래 기다린 요청"인가 — 계약에 SLA 가 없으므로 **우리 값**이다.
 * 넘긴 요청만 잉크가 바뀐다. 전부 바뀌면 아무것도 안 바뀐 것과 같다.
 */
const WAIT_WARN_DAYS = 3;

/** 요청이 기다린 일수. */
function waitedDays(iso: string | null | undefined): number {
  if (iso == null) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export default function RequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);
  const refreshNavCounts = useNavCountsRefresh();

  // 세 목록을 다 읽는다 — 안 보이는 탭의 건수를 탭 자신이 말해야 한다. 탭을 옮겨도
  // 다시 읽지 않으므로 진입 호출 수는 카드가 셋이던 때와 같다.
  const [tab, setTab] = useState<RequestTab>('pending');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list: PagedSection<RequestListRow> = tab === 'rejected' ? rejected : pending;
  const rows = list.paged?.content ?? [];

  // 선택은 목록을 따라간다 — 탭 전환·페이지 이동·처리 후 재조회가 전부 목록을 갈아치우고,
  // 그때 남아 있던 id 는 화면에 없는 요청을 가리킨다. "없으면 첫 줄"이 세 경우를 한 번에
  // 덮고, 목록이 비면 선택도 저절로 빈다.
  const current = rows.find((row) => row.targetSourceId === selectedId) ?? rows[0] ?? null;
  const currentId = current?.targetSourceId ?? null;

  const { reload: reloadPending } = pending;
  const { reload: reloadRejected } = rejected;
  const { reload: reloadHistory } = history;

  // 처리한 건은 대기에서 빠져 반려·이력으로 옮겨간다. 셋 다 다시 읽고, 나브 배지도 같이
  // 내린다 — 이 화면은 이동을 안 하므로 배지가 스스로 갱신될 기회가 없다.
  const onDecided = useCallback((): void => {
    setSelectedId(null);
    reloadPending();
    reloadRejected();
    reloadHistory();
    refreshNavCounts();
  }, [reloadPending, reloadRejected, reloadHistory, refreshNavCounts]);

  // 두 목록이 모두 도착해야 합이 사실이다 — 하나라도 로딩 중이면 수를 말하지
  // 않는다(스켈레톤 옆에서 32px 볼드로 '0건'은 모르는 값을 아는 척하는 것).
  const counted = pending.paged != null && rejected.paged != null;
  const todo = (pending.paged?.totalElements ?? 0) + (rejected.paged?.totalElements ?? 0);

  const tabs: readonly { key: RequestTab; label: string; count: number | undefined }[] = [
    { key: 'pending', label: '승인 대기', count: pending.paged?.totalElements },
    { key: 'rejected', label: '반려', count: rejected.paged?.totalElements },
    { key: 'history', label: '전체 History', count: history.paged?.totalElements },
  ];

  /** 레일 본문 — 오류 / 로딩 / 빈 상태 / 요청 카드들. */
  const rail: ReactNode =
    list.error != null ? (
      <div className={rq.state}>
        <span className="min-w-0 truncate">{errorMessage(list.error)}</span>
        <PlButton variant="secondary" size="sm" onClick={list.reload}>
          재시도
        </PlButton>
      </div>
    ) : list.loading ? (
      Array.from({ length: PAGE_SIZE }, (_, row) => (
        <div
          key={row}
          className={cn(rq.benchItem, rq.benchItemIdle)}
          aria-hidden="true"
          aria-busy="true"
        >
          <span className={rq.benchSkelTile} />
          <span className={cn(rq.skeletonBar, 'flex-1')} />
        </div>
      ))
    ) : rows.length === 0 ? (
      <div className={rq.empty}>
        <span className={rq.emptyTitle}>
          {tab === 'pending' ? '승인을 기다리는 요청이 없어요' : '확인 대기 중인 반려 건이 없어요'}
        </span>
        <span className={rq.emptyCaption}>
          {tab === 'pending'
            ? '새 연동 요청이 들어오면 여기에 표시돼요'
            : '반려 처리한 요청이 여기에 모여요'}
        </span>
      </div>
    ) : (
      rows.map((row) => {
        const id = row.targetSourceId;
        const on = id != null && id === currentId;
        const days = waitedDays(row.latestApprovalRequest?.requestedAt);
        const name = row.serviceName ?? `#${id}`;
        const code = row.serviceCode ?? '—';
        return (
          <button
            key={id ?? code}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => id != null && setSelectedId(id)}
            title={`${name} (${code})`}
            className={cn(rq.benchItem, on ? rq.benchItemActive : rq.benchItemIdle)}
          >
            <span
              className={cn(serviceSidebarStyles.tile, serviceTileClass(code))}
              aria-hidden="true"
            >
              {name.charAt(0).toUpperCase()}
            </span>
            <span className={rq.benchItemStack}>
              <span className={on ? rq.benchItemNameActive : rq.benchItemName}>{name}</span>
              {/* 코드와 Provider — 시트가 머리에서 쓰는 값과 같은 값이라야 레일에서 고른
                  것과 시트가 보여주는 것이 같다는 게 눈으로 확인된다. */}
              <span className={rq.benchItemMeta}>
                <span className={rq.benchItemCode}>{code}</span>
                <ProvTag provider={row.cloudProvider ?? ''} />
                {/* 대기는 승인 대기 탭에서만 뜻이 있다 — 반려된 요청은 더 안 기다린다. */}
                {tab === 'pending' && (
                  <span className={days >= WAIT_WARN_DAYS ? rq.benchWaitHot : rq.benchWait}>
                    {days}일
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })
    );

  return (
    <div>
      <h1 className={rq.pageTitle}>연동 요청</h1>
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

      {tab === 'history' ? (
        <section className={rq.section} aria-label="전체 History">
          <p className={rq.desc}>모든 연동 요청의 승인 처리 이력이에요</p>

          {/* 행은 flex div 라 표 의미를 명시적으로 선언한다 — 스크린리더가 "서비스 코드:
              STL" 로 읽는다. 메시지 상태들도 표 안의 행으로 남는다. */}
          <div role="table" aria-label="전체 History 목록">
            <div className={rq.headRow} role="row">
              {HISTORY_COLUMNS.map((col) => (
                <span key={col.label} role="columnheader" className={col.className}>
                  {col.label}
                </span>
              ))}
            </div>
            {history.error != null ? (
              <div role="row">
                <div role="cell" aria-colspan={HISTORY_COLUMNS.length} className={rq.state}>
                  <span className="min-w-0 truncate">{errorMessage(history.error)}</span>
                  <PlButton variant="secondary" size="sm" onClick={history.reload}>
                    재시도
                  </PlButton>
                </div>
              </div>
            ) : history.loading ? (
              // 실제 컬럼 폭으로 한 장(HISTORY_PAGE_SIZE 줄)을 그린다 — 탭이 로딩 동안
              // 제 크기를 지킨다.
              <div role="rowgroup" aria-busy="true" aria-label="이력을 불러오는 중">
                {Array.from({ length: HISTORY_PAGE_SIZE }, (_, row) => (
                  <div key={row} className={rq.row} role="row" aria-hidden="true">
                    {HISTORY_COLUMNS.map((col) => (
                      <span
                        key={col.label}
                        role="cell"
                        className={cn(col.className, rq.skeletonBar)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (history.paged?.content.length ?? 0) === 0 ? (
              <div role="row">
                <div role="cell" aria-colspan={HISTORY_COLUMNS.length} className={rq.empty}>
                  <span className={rq.emptyTitle}>표시할 승인 이력이 없어요</span>
                  <span className={rq.emptyCaption}>연동 요청이 처리되면 이력이 여기에 쌓여요</span>
                </div>
              </div>
            ) : (
              // key 는 historyRecordId (유일). targetSourceId·requestId 는 반복될 수 있어
              // key 로 못 쓴다.
              history.paged?.content.map((row) => (
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
            )}
          </div>

          <div className={rq.footer}>
            <OpsPagination
              page={history.page}
              totalPages={Math.max(1, history.paged?.totalPages ?? 1)}
              onChange={history.setPage}
              always
            />
          </div>
        </section>
      ) : (
        <div className={rq.bench}>
          <div className={rq.benchList}>
            <div
              className={rq.benchRows}
              aria-label={`${tab === 'pending' ? '승인 대기' : '반려'} 요청`}
            >
              {rail}
            </div>
            <div className={rq.benchFooter}>
              <OpsPagination
                page={list.page}
                totalPages={Math.max(1, list.paged?.totalPages ?? 1)}
                onChange={list.setPage}
                always
              />
            </div>
          </div>

          {/* 시트에는 제목이 없다(정체는 레일이 말한다) — 표제가 없는 자리라 랜드마크
              이름은 여기서 준다. 스크린리더가 "무엇의 상세인지"를 알 곳이 이 한 줄뿐이다. */}
          <div
            className={rq.benchPane}
            role="region"
            aria-label={current != null ? `${current.serviceName ?? `#${currentId}`} 연동 요청` : '연동 요청 상세'}
          >
            {currentId == null ? (
              <div className={rq.empty}>
                <span className={rq.emptyTitle}>고를 요청이 없어요</span>
                <span className={rq.emptyCaption}>
                  왼쪽 목록에 요청이 들어오면 여기에서 처리해요
                </span>
              </div>
            ) : (
              // key 로 다시 마운트한다 — 리소스 필터·페이지·모달까지 전 요청의 상태가
              // 남으면 새 요청을 옛 조건으로 읽게 된다.
              <RequestDetail
                key={currentId}
                targetSourceId={currentId}
                onDecided={onDecided}
                identity={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
