'use client';

/**
 * P2 연동 요청 (/admin/pipelines/queue/requests) — 큐 레일 + 표 한 장.
 *
 * 전에는 이 화면이 세 개의 형제였다 — 카드 셋이었다가 탭 셋이었다. 둘 다 계층이 안
 * 읽혔는데, 배치 때문이 아니라 셋이 형제였기 때문이다: 형제 상자에는 크기·순서·색
 * 어떤 레버를 줘도 등급이 안 생긴다. 실측이 그 값을 말한다 — 읽기만 하는 전체 History
 * 가 1267×385 로, 유일하게 손대야 하는 승인 대기(621×360)의 2.18배였고, 세 제목은
 * 전부 17px 이었다. 게다가 History 표의 상위 네 줄은 승인 대기 카드의 그 네 건과
 * **같은 요청**이라, 한 화면에서 같은 대상이 두 계급을 동시에 갖고 있었다.
 *
 * 그래서 표면을 하나로 줄이고, 계층은 왼쪽 레일의 **그룹 헤더로 문자로 선언**한다 —
 * `작업`(승인 대기·반려)과 `기록`(전체 이력). 오른쪽은 고른 뷰 하나의 표다.
 * 세 건수가 레일 한 열에 정렬되므로 4·2·23 이 처음으로 서로 비교된다.
 * (design benchmark 2026-08-17 시안 C — docs/ux/benchmark/queue-requests-three-surfaces.md)
 *
 * 레일이 담는 것은 **뷰**이지 요청이 아니다. 워크벤치 라운드에서 접었던 레일은 요청
 * 목록을 담았고 "항목 3개엔 과하다"는 판정을 받았는데, 여기 레일은 항목이 늘지 않는
 * 목차라 그 판정의 전제가 다르다(오너 결정 2026-08-17, 그 판정을 뒤집음).
 *
 * 요청 하나는 **기존처럼 상세 라우트에서** 읽고 결정한다 — 행 전체가 그 링크다.
 * 레일 문법(그룹 제목 12px + 14px 항목 + 우측 건수)은 섹션 내비게이션(pipelines/
 * layout.tsx)의 것을 밝은 팔레트로 옮긴 것이다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { getApprovalHistory, getRequestList } from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

/**
 * 세 뷰가 같은 한 장을 쓴다.
 *
 * 카드 시절의 5는 2단 카드가 서로 높이를 맞추느라 정한 수였고, 지금은 표 하나가
 * 전폭을 쓰므로 그 제약이 없다. 셋 다 같은 수라야 뷰를 옮길 때 표가 자라거나
 * 줄지 않는다 — 레일에서 고르는 것은 내용이지 화면 크기가 아니다.
 */
const PAGE_SIZE = 8;

/**
 * 며칠부터 "오래 기다린 요청"인가 — 계약에 SLA 가 없으므로 **우리 값**이다.
 * 넘긴 요청만 잉크가 바뀐다. 전부 바뀌면 아무것도 안 바뀐 것과 같다.
 */
const WAIT_WARN_DAYS = 3;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** 요청이 기다린 일수. */
function waitedDays(iso: string | null | undefined): number {
  if (iso == null) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

// Stable (module-level) view fetchers — one server page (0-based) each, so
// the useAbortableEffect deps stay identity-stable and never re-fire per render.
const fetchPending = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('PENDING', page, { ...opts, size: PAGE_SIZE });
const fetchRejected = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('REJECTED', page, { ...opts, size: PAGE_SIZE });
const fetchHistory = (page: number, opts: { signal: AbortSignal }): Promise<Paged<ApprovalHistoryRow>> =>
  getApprovalHistory(page, { ...opts, size: PAGE_SIZE });

interface PagedView<T> {
  /** 0-based server page — same base as the pager, so nothing converts. */
  page: number;
  paged: Paged<T> | null;
  loading: boolean;
  error: unknown;
  setPage: (n: number) => void;
  reload: () => void;
}

/** One paginated view's data state. */
function usePagedView<T>(
  fetcher: (page: number, opts: { signal: AbortSignal }) => Promise<Paged<T>>,
): PagedView<T> {
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
          // 짧게 만드는 화면이라, 그냥 두면 레일은 "4건"인데 표는 빈 상태가 된다.
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

  return { page, paged, loading, error, setPage, reload: () => setRetry((n) => n + 1) };
}

const rq = {
  pageTitle: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  /** 16px — 이 문장이 화면이 먼저 말하는 사실이라 본문 급으로 올린다(오너 지시
   *  2026-08-15). 권한 요청의 `pageDesc` 와 같은 값이다. */
  context: 'mt-1 text-[16px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',

  /** 레일 168 + 헤어라인 + 여백. 레일은 카드가 아니다 — 이 화면에서 테두리를 가진
   *  표면은 없고, 레일과 표는 세로선 하나로만 갈린다(조작 대상은 표 하나뿐). */
  split: 'mt-6 flex items-start gap-6',
  rail: 'w-[168px] flex-none border-r border-[var(--pl-border)] pr-3',
  /** 그룹 제목 — 섹션 내비의 `sidebarTitle` 과 같은 12px/semibold/0.06em 이되,
   *  밝은 바닥이라 잉크만 바꾼다. 저쪽 gray-400 은 어두운 사이드바 위 값이라
   *  흰 바닥에서 2.58:1 로 떨어진다. weak(#667085, 4.95:1)이 흰 바닥의 같은 자리다.
   *
   *  표 머리(headRow)보다 한 단 진한 것은 의도다 — 이 두 글자가 이 화면의 계층
   *  선언이고, 컬럼 이름은 그 아래 부속이다. */
  railGroup:
    'block px-2.5 pt-2 pb-2.5 text-[12px] font-semibold tracking-[0.06em] text-[var(--pl-text-weak)]',
  /** 항목 base 는 색·굵기를 안 갖는다 — idle/active 가 소유한다(`cn` 은 단순 join
   *  이라 겹치는 유틸리티가 같이 오면 Tailwind 출력 순서가 이긴다). */
  railItem:
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-[7px] mb-0.5 text-left text-[14px] transition-colors',
  railItemIdle: 'font-medium text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-100)]',
  railItemActive: 'font-semibold bg-[var(--pl-primary-bg)] text-[var(--pl-primary)]',
  /** 건수는 오른쪽 끝에 — 세 뷰의 수가 한 열에 정렬되어야 서로 비교된다. */
  railCount: 'ml-auto flex-none text-[12px] font-semibold tabular-nums',
  railCountIdle: 'text-[var(--pl-text-weak)]',
  railCountActive: 'text-[var(--pl-primary)]',
  /** 아직 모르는 수 자리 — 레일 폭이 흔들리지 않게 같은 자리를 잡아 둔다. */
  railCountSkel: 'ml-auto h-3 w-4 flex-none animate-pulse rounded-[4px] bg-[var(--pl-gray-100)]',

  /** 표 쪽. 제목은 두지 않는다 — 뷰 이름은 레일이 이미 말하고, 여기 다시 쓰면 한
   *  화면에 같은 이름이 두 번이다. 대신 "무엇을 해야 하는가" 한 줄이 선다. */
  pane: 'flex min-w-0 flex-1 flex-col',
  desc: 'text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-row-hover)]',

  /**
   * 컬럼 폭 — 머리 행·스켈레톤·데이터 행이 함께 쓴다.
   *
   * 어디에도 `flex-none` 이 없다: 셸의 1080 바닥에서 고정 셀이 먼저 양보하고 표
   * 밖으로 그려지지 않는다. 카드 시절의 폭을 그대로 쓴다 — 표가 넓어져 남는 폭은
   * 전부 `flex-1` 인 이름·내용 두 칸으로 간다.
   */
  service: 'min-w-0 flex-1 truncate',
  serviceName: 'font-medium text-[var(--pl-text-strong)]',
  code: 'w-[72px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  target: 'w-[56px] min-w-0 shrink truncate',
  cloud: 'w-[64px] min-w-0 shrink truncate',
  // 대기 경과 — 기록이 못 하는 말이라 승인 대기 뷰만 쓴다. 56 = '999일' pill 폭.
  wait: 'w-[56px] min-w-0 shrink truncate',
  // 잘린 전문은 행을 눌러 상세에서 읽는다 — pointer-events-none 이라야 이 셀이
  // 행 링크 오버레이의 클릭을 가로채지 않는다.
  note: 'min-w-0 flex-1 truncate pointer-events-none',
  // 116 = 가장 긴 pill('연동 불가 확인': 6 한글 72 + 점 6 + gap 6 + 좌우 패딩 17)
  // 에 여유를 더한 값. truncate 는 그래도 남겨 둔다 — pill 은 원자적 박스라
  // 넘치면 옆 컬럼을 밀지 않고 그 위에 겹쳐 그려진다.
  status: 'w-[116px] min-w-0 shrink truncate',
  actor: 'w-[120px] min-w-0 shrink truncate',
  // 124 = 'YYYY-MM-DD HH:mm' at 14px tabular(≈118)에 여유. 좁히면 분 단위가
  // 조용히 잘려 나가므로 여유를 둔다. nowrap 이라 truncate 로 행을 지킨다.
  when: 'w-[124px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  // 꼬리 글리프 — faint 는 흰 바닥에서 2.58:1 이라 비문자 UI 요소의 3:1 도 못 넘는다.
  // weak 은 4.95:1 이면서 행 본문(medium)보다는 여전히 옅어 순위가 유지된다.
  chev: 'w-3.5 flex-none text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',

  /** 대기 pill — 임계를 넘으면 잉크가 바뀐다. */
  waitPill:
    'inline-block rounded-full bg-[var(--pl-gray-100)] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-text-medium)]',
  waitPillHot:
    'inline-block rounded-full bg-[var(--pl-warn-bg)] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--pl-warn-text)]',

  skeletonBar: 'h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  state: 'flex items-center gap-2 py-2.5 text-[14px] text-[var(--pl-text-weak)]',
  empty: 'flex flex-col items-center justify-center gap-0.5 py-9 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyCaption: 'text-[12px] text-[var(--pl-text-weak)]',
  footer: 'mt-auto',
} as const;

/** 표 한 컬럼의 라벨과 셀들이 공유하는 폭 클래스. 라벨이 없는 칸은 꼬리(› 아이콘)
 *  — 머리 글자도 없고 로딩 중 스켈레톤 막대도 없다. */
interface Column {
  label?: string;
  className: string;
}

/** 승인 대기·반려는 같은 골격이다 — 두 칸(내용·일자)의 이름만 다르다. 같은 폭,
 *  같은 `flex-1` 개수라야 뷰를 옮겨도 표가 제자리에 선다. */
const requestColumns = (note: string, when: string, wait: boolean): readonly Column[] => [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Cloud', className: rq.cloud },
  ...(wait ? [{ label: '대기', className: rq.wait }] : []),
  { label: note, className: rq.note },
  { label: when, className: rq.when },
  { className: rq.chev },
];

const PENDING_COLUMNS = requestColumns('설명', '요청 일자', true);
const REJECTED_COLUMNS = requestColumns('반려 사유', '반려 일자', false);

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Target', className: rq.target },
  { label: 'Cloud', className: rq.cloud },
  { label: '상태', className: rq.status },
  { label: '수행자', className: rq.actor },
  { label: '일시', className: rq.when },
];

type ViewKey = 'pending' | 'rejected' | 'history';

/** 레일이 그리는 목차 — 그룹이 곧 계층 선언이다. */
const RAIL_GROUPS: readonly { title: string; views: readonly ViewKey[] }[] = [
  { title: '작업', views: ['pending', 'rejected'] },
  { title: '기록', views: ['history'] },
];

const VIEW_LABEL: Record<ViewKey, string> = {
  pending: '승인 대기',
  rejected: '반려',
  history: '전체 이력',
};

const VIEW_DESC: Record<ViewKey, string> = {
  pending: '승인이 필요한 연동 요청이에요 — 행을 눌러 요청 내역을 확인하고 승인하거나 반려해 주세요',
  rejected: '반려했으나 서비스 측 담당자가 아직 확인하지 않았어요 — 행을 눌러 사유와 요청 내역을 볼 수 있어요',
  history: '모든 연동 요청의 승인 처리 이력이에요',
};

const VIEW_EMPTY: Record<ViewKey, { title: string; caption: string }> = {
  pending: { title: '승인을 기다리는 요청이 없어요', caption: '새 연동 요청이 들어오면 여기에 표시돼요' },
  rejected: { title: '확인 대기 중인 반려 건이 없어요', caption: '반려 처리한 요청이 여기에 모여요' },
  history: { title: '표시할 승인 이력이 없어요', caption: '연동 요청이 처리되면 이력이 여기에 쌓여요' },
};

const VIEW_COLUMNS: Record<ViewKey, readonly Column[]> = {
  pending: PENDING_COLUMNS,
  rejected: REJECTED_COLUMNS,
  history: HISTORY_COLUMNS,
};

interface ViewTableProps<T> {
  view: PagedView<T>;
  /** 머리 행과 로딩 스켈레톤을 함께 몰아서, 둘이 데이터 행의 폭과 어긋날 수 없게 한다. */
  columns: readonly Column[];
  label: string;
  empty: { title: string; caption: string };
  children: (rows: T[]) => ReactNode;
}

/** 뷰 하나의 표 — 머리 행 / 본문(오류·로딩·빈 상태·행) / 바닥에 붙는 페이저.
 *  카드 껍데기는 없다: 이 화면에서 테두리를 갖는 표면은 하나도 없다. */
function ViewTable<T>({ view, columns, label, empty, children }: ViewTableProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = view;
  const rows = paged?.content ?? [];

  return (
    <>
      {/* 행은 flex div 라 표 의미를 명시적으로 선언한다 — 스크린리더가 "서비스 코드:
          STL" 로 읽는다. 메시지 상태들도 표 안의 행으로 남는다. */}
      <div role="table" aria-label={`${label} 목록`}>
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
          // 실제 컬럼 폭으로 한 장을 그린다 — 뷰가 로딩 동안 제 크기를 지킨다.
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
    </>
  );
}

/** 승인 대기·반려 공통 행 — 이름 셀 안의 오버레이가 행 전체를 상세 라우트로 만든다. */
function RequestRow({
  row,
  note,
  when,
  wait,
  action,
}: {
  row: RequestListRow;
  note: string;
  when: string | null | undefined;
  /** 대기 일수 — 승인 대기 뷰만 준다(반려된 요청은 더 안 기다린다). */
  wait: number | null;
  action: string;
}): ReactElement {
  const id = row.targetSourceId;
  return (
    <div role="row" className={cn(rq.row, id != null && rq.rowLink)}>
      {/* 링크는 첫 셀 안에 둔다 — role=row 는 셀만 자식으로 가져야 해서, 행 직속
          <a> 는 스크린리더 순회에서 지워질 수 있다. absolute inset-0 이라 위치는
          그대로 행 전체를 덮는다. */}
      <span role="cell" className={cn(rq.service, rq.serviceName)}>
        {id != null && (
          <Link
            href={passRoutes.pipelines.queue.request(id)}
            aria-label={`${row.serviceName ?? `Target Source ${id}`} ${action}`}
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
      {wait != null && (
        <span role="cell" className={rq.wait}>
          <span className={wait >= WAIT_WARN_DAYS ? rq.waitPillHot : rq.waitPill}>{wait}일</span>
        </span>
      )}
      {/* 미리보기 한 줄. 전문은 행을 눌러 상세에서 — hover 툴팁은 두지 않는다:
          툴팁을 띄우려면 이 셀이 포인터를 받아야 하고, 그러면 같은 자리에서 행
          링크 클릭이 죽는다. */}
      <span role="cell" className={rq.note}>
        {note}
      </span>
      <span role="cell" className={rq.when}>
        {fmtDateTime(when)}
      </span>
      <span role="cell" className={rq.chev}>
        <Icon name="arrow-up-right" size="sm" />
      </span>
    </div>
  );
}

export default function RequestsPage(): ReactElement {
  const pending = usePagedView(fetchPending);
  const rejected = usePagedView(fetchRejected);
  const history = usePagedView(fetchHistory);

  // 세 뷰를 다 읽는다 — 안 보이는 뷰의 건수를 레일이 말해야 한다. 뷰를 옮겨도
  // 다시 읽지 않으므로 진입 호출 수는 카드가 셋이던 때와 같다.
  const [view, setView] = useState<ViewKey>('pending');

  const counts: Record<ViewKey, number | undefined> = {
    pending: pending.paged?.totalElements,
    rejected: rejected.paged?.totalElements,
    history: history.paged?.totalElements,
  };

  // 두 목록이 모두 도착해야 합이 사실이다 — 하나라도 로딩 중이면 수를 말하지
  // 않는다(스켈레톤 옆에서 32px 볼드로 '0건'은 모르는 값을 아는 척하는 것).
  const counted = pending.paged != null && rejected.paged != null;
  const todo = (pending.paged?.totalElements ?? 0) + (rejected.paged?.totalElements ?? 0);

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

      <div className={rq.split}>
        <nav className={rq.rail} aria-label="연동 요청 목차">
          {RAIL_GROUPS.map((group) => (
            <div key={group.title}>
              <span className={rq.railGroup}>{group.title}</span>
              {group.views.map((key) => {
                const on = key === view;
                const count = counts[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => setView(key)}
                    className={cn(rq.railItem, on ? rq.railItemActive : rq.railItemIdle)}
                  >
                    {VIEW_LABEL[key]}
                    {/* 아직 모르는 수는 쓰지 않는다 — 자리만 잡아 둔다. */}
                    {count != null ? (
                      <span
                        className={cn(rq.railCount, on ? rq.railCountActive : rq.railCountIdle)}
                      >
                        {count.toLocaleString()}
                      </span>
                    ) : (
                      <span className={rq.railCountSkel} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <section className={rq.pane} aria-label={VIEW_LABEL[view]}>
          <p className={rq.desc}>{VIEW_DESC[view]}</p>

          {view === 'history' ? (
            <ViewTable
              view={history}
              columns={VIEW_COLUMNS.history}
              label={VIEW_LABEL.history}
              empty={VIEW_EMPTY.history}
            >
              {(rows) =>
                // key 는 historyRecordId (유일). targetSourceId·requestId 는 반복될 수
                // 있어 key 로 못 쓴다.
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
            </ViewTable>
          ) : view === 'rejected' ? (
            <ViewTable
              view={rejected}
              columns={VIEW_COLUMNS.rejected}
              label={VIEW_LABEL.rejected}
              empty={VIEW_EMPTY.rejected}
            >
              {(rows) =>
                rows.map((row) => (
                  <RequestRow
                    key={row.targetSourceId ?? row.serviceCode}
                    row={row}
                    note={row.latestApprovalRequest?.reason ?? '—'}
                    when={row.latestApprovalRequest?.processedAt}
                    wait={null}
                    action="반려 내역 상세 보기"
                  />
                ))
              }
            </ViewTable>
          ) : (
            <ViewTable
              view={pending}
              columns={VIEW_COLUMNS.pending}
              label={VIEW_LABEL.pending}
              empty={VIEW_EMPTY.pending}
            >
              {(rows) =>
                rows.map((row) => (
                  <RequestRow
                    key={row.targetSourceId ?? row.serviceCode}
                    row={row}
                    note={row.description ?? '—'}
                    when={row.latestApprovalRequest?.requestedAt}
                    wait={waitedDays(row.latestApprovalRequest?.requestedAt)}
                    action="연동 요청 상세 보기"
                  />
                ))
              }
            </ViewTable>
          )}
        </section>
      </div>
    </div>
  );
}
