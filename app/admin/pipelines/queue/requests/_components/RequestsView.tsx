'use client';

/**
 * P2 연동 요청 (/admin/pipelines/queue/requests) — queue rail + one table.
 *
 * The screen used to be three SectionCards (두 장 나란히 + 전체 폭 이력 한 장), each
 * reading its own page. Three tables competing on one screen made every column
 * a 2-up column: 서비스 이름 and 설명 shared ~536px at 1440 and collapsed outright
 * at the 1080 shell floor. Now the three are VIEWS, not sections — the rail on
 * the left says which one, the single card on the right shows it at full width.
 *
 * The rail is a page-level table of contents, not a second app sidebar: it
 * starts UNDER the h1, is not sticky and is not viewport-tall, so the title
 * visibly contains it. It paints no plane of its own either — only the selected
 * item does (a white card chip on the recessed ground), so the rail ranks by
 * elevation rather than by a second fill.
 *
 * Only the selected view's rows are on screen, but every count is: each view
 * fetches its page 0 once, and only the selected one re-fetches as the pager
 * moves (the others hold a page number that never changes). A count is withheld
 * until that view's first page lands — '0건' next to a skeleton is a number we
 * do not have yet.
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';

import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime, WAIT_WARN_DAYS, waitedDays } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import {
  InstallationLifecycleLegend,
  InstallationLifecycleTag,
} from '@/app/admin/pipelines/_components/InstallationLifecycleTag';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { InfoTooltip } from '@/app/components/ui/Tooltip';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
// 대기 경과는 접근 권한 큐가 이미 쓰는 알약 그대로다 — 같은 질문("이건 얼마나
// 오래 서 있었나")에 두 화면이 다른 잉크로 답하면 임계가 화면마다 달라 보인다.
import { accessStyles } from '@/app/admin/pipelines/access/_components/accessStyles';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import type { RequestView } from '@/app/admin/pipelines/queue/requests/_views';
import {
  getApprovalHistory,
  getRecentTargetSources,
  getRequestList,
} from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

/**
 * 8 rows is the card body every view shares. It is the same number for all three
 * so the table does not grow or shrink as the rail moves — the card is one
 * surface holding different contents, not three cards of different heights.
 */
const PAGE_SIZE = 8;

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// Stable (module-level) view fetchers — one server page (0-based) each, so the
// useAbortableEffect deps stay identity-stable and never re-fire per render.
const fetchPending = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('PENDING', page, { ...opts, size: PAGE_SIZE });
const fetchRejected = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRequestList('REJECTED', page, { ...opts, size: PAGE_SIZE });
const fetchHistory = (page: number, opts: { signal: AbortSignal }): Promise<Paged<ApprovalHistoryRow>> =>
  getApprovalHistory(page, { ...opts, size: PAGE_SIZE });
const fetchRecent = (page: number, opts: { signal: AbortSignal }): Promise<Paged<RequestListRow>> =>
  getRecentTargetSources(page, { ...opts, size: PAGE_SIZE });

interface PagedSection<T> {
  /** 0-based server page — same base as the pager, so nothing converts. */
  page: number;
  paged: Paged<T> | null;
  loading: boolean;
  error: unknown;
  setPage: (n: number) => void;
  reload: () => void;
}

/** One paginated view's data state. */
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

/** Visual tone of a view — drives its 건수 badge only; the two 작업 views read as
 *  primary/danger, the audit log as neutral. */
type SectionTone = 'primary' | 'danger' | 'muted';

const TONE_BADGE: Record<SectionTone, string> = {
  primary: 'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
  danger: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  muted: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
};

const rq = {
  /**
   * Ground — full-bleed --pl-gray-200. The negative margins cancel this route's
   * shell padding (layout.contentFluid: px-8 pt-6 pb-12) exactly, then `body`
   * re-applies it, so the fill reaches the viewport edges while the content
   * keeps the gutter every sibling admin screen uses. Same escape hatch as
   * opsStyles.page.
   */
  page: '-mx-8 -mt-6 -mb-12 flex min-h-[calc(100vh_-_64px)] flex-col bg-[var(--pl-gray-200)]',
  body: 'px-8 pt-6 pb-12',

  h1: 'text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  // 이 줄은 카드가 아니라 gray-200 바닥 위에 바로 선다 — weak 는 그 바닥에서 4.01:1
  // (AA 미달)이라 medium(8.44:1)이 이 자리의 잉크다.
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  // 히어로의 자리표시자는 카드 안 스켈레톤과 바닥이 다르다 — gray-100 은 gray-200
  // 위에서 거의 사라진다. 한 칸 더 어두운 gray-300 이라야 '아직 모른다'가 보인다.
  contextSkeleton: 'mx-1 inline-block h-6 w-7 animate-pulse rounded-[6px] align-baseline bg-[var(--pl-gray-300)]',

  /** 제목 아래에서 시작하는 2단 — 레일은 화면 높이도, sticky 도 아니다. */
  split: 'mt-6 grid grid-cols-[168px_1fr] gap-6 items-start',

  /** 레일은 제 면을 그리지 않는다 (R1) — 칠은 고른 항목에만 있다. */
  rail: 'min-w-0',
  // ⛔ pipelineText.sidebarTitle 은 gray-400 이고 어두운 사이드바 전용이다. 이 밝은
  // 바닥 위에서는 2.08:1 로 읽히지 않으므로 같은 자·굵기에 잉크만 medium 이다.
  railTitle:
    'block px-2.5 pt-2 pb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--pl-text-medium)]',
  railGroup: 'mt-1 first:mt-0',
  // 포커스 링은 여기서 선언하지 않는다 — globals.css 의 `*:focus-visible` 이 캐스케이드
  // 레이어 **밖에서** 2px/offset 2 링을 이미 그리고, 레이어 밖 선언이 유틸리티를 이긴다
  // (같은 파일의 .ec2-search-field 주석이 그 이유를 적어 둔 자리다). 여기 유틸리티를
  // 더하면 적용되지 않는 클래스만 남는다.
  railItem:
    'flex w-full items-center justify-between gap-2 px-2.5 py-[7px] mb-0.5 rounded-md text-[14px] text-left transition-colors',
  // hover 는 흰 칠의 절반이다 — white/50 이 --pl-gray-200 바닥 위에 합성된 값은 그
  // 바닥에서 1.11:1 올라가고, 고른 항목의 흰 면은 1.24:1 올라간다. 60% 로 칠하면
  // hover 가 1.14 까지 올라와 고른 항목과 1.09 밖에 안 벌어진다: 스쳐 지나가는 상태가
  // '여기 있다'와 같은 급이 된다.
  railItemIdle: 'text-[var(--pl-text-medium)] hover:bg-white/50',
  railItemActive:
    'bg-[var(--pl-bg-card)] font-semibold text-[var(--pl-text-strong)] shadow-[var(--pl-shadow-xs)]',
  railItemLabel: 'min-w-0 truncate',
  // 건수는 두 상태에서 같은 잉크다. faint/weak 는 gray-200 바닥에서 각각 2.58:1 ·
  // 4.01:1 이라 AA 를 넘지 못한다 — 고른 항목(흰 면) 기준으로 고르면 안 고른 쪽이
  // 바닥에서 흐려진다.
  railCount: 'flex-none text-[12px] tabular-nums text-[var(--pl-text-medium)]',

  /** 표 카드 — 운영 콘솔이 쓰는 카드 그대로 (pipelineStyles.card.base). */
  card:
    'min-w-0 bg-[var(--pl-bg-card)] border border-[var(--pl-border)] rounded-[10px] shadow-[var(--pl-shadow-xs)] px-6 pt-5 pb-6 flex flex-col',
  head: 'flex items-center justify-between gap-3',
  title: 'text-[18px] font-semibold leading-[1.4] text-[var(--pl-text-strong)]',
  badge: 'inline-flex flex-none items-center rounded-full px-2 py-[3px] text-[12px] font-semibold tabular-nums',
  desc: 'mt-1.5 text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',

  // 열 이름은 --pl-text-faint(흰 면에서 2.58:1) 가 아니라 --pl-text-weak(4.97:1) 다 —
  // 어느 값이 어느 열인지 못 읽으면 표가 아니라 문자열 격자다.
  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-weak)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[14px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',

  /**
   * Column widths — shared by a view's header row and its data rows.
   *
   * WIDTH BUDGET — one full-width table under a 168px rail. Measured in the
   * browser: the card's inner width is 918 at 1440 (viewport − 216 sidebar − 64
   * content padding − 168 rail − 24 rail gutter − 48 card padding − 2 border)
   * and 558 at the shell's 1080 floor; the 2-up card it replaces had 536 and
   * 340. Seven gaps of 12 (six before the Lifecycle column) leave 834 / 474 for
   * the cells themselves.
   *
   * Fixed columns are sized to their real ink (Range rects at 14px, not round
   * numbers) and every one of them is SHRINKABLE — no `flex-none` on a text
   * column, so when the floor budget runs out the fixed cells give way instead
   * of painting outside the card. At 1440 nothing truncates but the two preview
   * columns that are meant to (설명 375→196, 반려 사유 932→196). At 1080 every
   * view is over budget and scrolls sideways instead (`rowsMinWidth`).
   *
   * 승인 대기 / 반려 미확인 run the same skeleton (service · code · cloud · lifecycle ·
   * note · wait · when · tail), including the same COUNT of flex-1 columns, so the two
   * 작업 views hold identical geometry as the rail switches between them. Give
   * one of them an extra flexible column and 서비스 이름 jumps width on a click.
   *
   * Target #id is deliberately absent from the 작업 views: the row already links
   * to that id's page. 전체 이력 keeps it — those rows do not link anywhere.
   */
  // 72 = 이름 두 글자 + 말줄임. flex-1 은 basis 0 이라 **줄어들지 않고** 남는
  // 자리만 받는다 — 바닥(1080)에서 고정 열 합이 예산을 넘으면 이 열이 0 이 되어
  // 신원 열이 통째로 사라졌다(전체 이력 7열). 바닥값이 그걸 막는다.
  service: 'min-w-[72px] flex-1 truncate',
  serviceName: 'font-medium text-[var(--pl-text-strong)]',
  // 76 = '서비스 코드' 머리글(12px 6자 ≈ 66)에 여유. 값은 12px mono 3~6자.
  code: 'w-[76px] min-w-0 shrink truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  // 48 = '#1801'(12px mono ≈ 36)과 'Target' 머리글(34) 중 큰 쪽에 여유.
  target: 'w-[48px] min-w-0 shrink truncate',
  // 88 = ProvTag 의 가장 긴 조합('Azure' + 글리프 + gap + 「중국」 칩 = 86). 72 는 칩이
  // 없던 때의 값이라 'AWS 중국'(80)이 잘렸다.
  cloud: 'w-[88px] min-w-0 shrink truncate',
  // 84 = the widest tag ('연동 내용 변경', measured 80.1) with slack. The header
  // ('Lifecycle' + the 13px (?) glyph) is 64.
  lifecycle: 'flex w-[84px] min-w-0 shrink items-center gap-1',
  // 잘린 전문은 행을 눌러 상세에서 읽는다 — pointer-events-none 이라야 이 셀이
  // 행 링크 오버레이의 클릭을 가로채지 않는다.
  note: 'min-w-[72px] flex-1 truncate pointer-events-none',
  // 116 = 가장 긴 pill('연동 불가 확인': 6 한글 72 + 점 6 + gap 6 + 좌우 패딩 17)
  // 에 여유를 더한 값. truncate 는 그래도 남겨 둔다 — pill 은 원자적 박스라
  // 넘치면 옆 컬럼을 밀지 않고 그 위에 겹쳐 그려진다.
  status: 'w-[116px] min-w-0 shrink truncate',
  // 112 = 짧은 계정 id 는 다 들어가고, 긴 메일 주소는 어느 폭에서도 잘린다.
  actor: 'w-[112px] min-w-0 shrink truncate',
  // 60 = 대기 알약('999일': 12px tabular 5자 ≈ 38 + 좌우 패딩 16)에 여유. 알약이라
  // 셀이 좁아져도 겹쳐 그려질 뿐 옆 열을 밀지 않는다.
  wait: 'w-[60px] min-w-0 shrink truncate',
  // 136 = 'YYYY-MM-DD HH:mm' at 14px tabular(≈122)에 여유. 행이 13→14px 로 커졌으니
  // 124 로 두면 분 단위가 조용히 잘려 나간다. nowrap 이라 truncate 로 행을 지킨다.
  when: 'w-[136px] min-w-0 shrink truncate whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
  // 꼬리 글리프도 faint 를 벗는다 — 흰 면에서 2.58:1 은 1.4.11(비텍스트 3:1)도 못
  // 넘는다. 이 열이 "행이 어딘가로 간다"고 말하는 유일한 표시다.
  chev: 'w-3.5 flex-none text-[var(--pl-text-weak)] group-hover:text-[var(--pl-primary)]',

  /** Loading bar inside a skeleton cell — same grammar as opsStyles.skeleton
   *  (task detail / 스캔 이력), sized down to a text line. */
  skeletonBar: 'h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',

  state: 'flex items-center gap-2 py-2.5 text-[14px] text-[var(--pl-text-weak)]',
  empty: 'flex flex-col items-center justify-center gap-0.5 py-9 text-center',
  emptyTitle: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  emptyCaption: 'text-[12px] text-[var(--pl-text-weak)]',
  footer: 'mt-auto',
} as const;

/** One column of a view — its label and the width class its cells share.
 *  A column with no label is a tail slot (the › chevron): no header text, and
 *  no skeleton bar while loading. */
interface Column {
  label?: string;
  className: string;
  /** Sits after the label. The header is the one place in this table that can take
   *  the pointer — the rows are under the row-link overlay. */
  hint?: ReactNode;
}

const LIFECYCLE_COLUMN: Column = {
  label: 'Lifecycle',
  className: rq.lifecycle,
  hint: <InfoTooltip content={<InstallationLifecycleLegend />} label="Lifecycle 설명" />,
};

/** The two 작업 views share one skeleton — same widths, same flex-1 count — so
 *  the table holds its geometry as the rail switches. Only the note/date labels
 *  differ. */
const actionColumns = (note: string, when: string): readonly Column[] => [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Cloud', className: rq.cloud },
  LIFECYCLE_COLUMN,
  { label: note, className: rq.note },
  { label: '대기', className: rq.wait },
  { label: when, className: rq.when },
  { className: rq.chev },
];

/**
 * 670 = service 72 + code 76 + cloud 72 + lifecycle 84 + note 72 + wait 60 + when 136
 * + chev 14 (586) + seven gaps of 12. The Lifecycle column put the 작업 views over the
 * 558 the card has at the 1080 floor; below 670 the card scrolls sideways rather than
 * letting 요청 일자 lose its minutes (the same call 전체 이력 made).
 */
const ACTION_ROWS_MIN_WIDTH = 'min-w-[670px]';

const PENDING_COLUMNS = actionColumns('설명', '요청 일자');
const REJECTED_COLUMNS = actionColumns('반려 사유', '반려 일자');

/**
 * 최근 생성 — 두 작업 뷰의 골격에서 **대기**만 뺀 것이다. 갓 생긴 대상은 아직 아무
 * 줄에도 서 있지 않으니 "얼마나 오래 서 있었나"에 답할 것이 없다. 나머지는 같은 열,
 * 같은 폭이라 레일이 작업 묶음 안에서 움직여도 표의 신원 열이 안 흔들린다.
 *
 * With the Lifecycle column the fixed cells come to 76 + 72 + 84 + 136 + 14 = 382
 * and six gaps to 72; the two flexible columns need 72 each, so the rows want 598
 * against 558 at the 1080 floor — hence `rowsMinWidth` below.
 */
const RECENT_COLUMNS: readonly Column[] = [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Cloud', className: rq.cloud },
  LIFECYCLE_COLUMN,
  { label: '설명', className: rq.note },
  { label: '생성 일자', className: rq.when },
  { className: rq.chev },
];

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Target', className: rq.target },
  { label: 'Cloud', className: rq.cloud },
  { label: '상태', className: rq.status },
  { label: '수행자', className: rq.actor },
  { label: '일시', className: rq.when },
  { className: rq.chev },
];

/**
 * 행 전체를 덮는 이동 링크 — 목적지는 뷰가 고른다 (오너 지시). 요청 두 뷰(승인 대기 ·
 * 반려 미확인)는 P3 연동 요청 상세로 간다: 그 행에 해야 할 일이 승인·반려이고, 반려
 * 사유 전문도 거기 있다. 최근 생성 · 전체 이력은 Target Source 운영 상세로 간다 —
 * `tab` 을 붙이지 않으므로 진행 상태로 떨어진다.
 *
 * 링크는 첫 셀 **안에** 둔다 — role=row 는 셀만 자식으로 가져야 해서, 행 직속 <a> 는
 * 스크린리더 순회에서 지워질 수 있다. absolute inset-0 이라 위치는 그대로 행 전체를
 * 덮는다.
 */
function RowLink({
  id,
  serviceName,
  to = 'ops',
}: {
  id: number;
  serviceName: string | null;
  to?: 'ops' | 'request';
}): ReactElement {
  const label = to === 'request' ? '연동 요청 상세' : '운영 상세';
  return (
    <Link
      href={
        to === 'request'
          ? passRoutes.pipelines.queue.request(id)
          : passRoutes.pipelines.ops.targetSource(id)
      }
      aria-label={`${serviceName ?? `Target Source ${id}`} ${label} 보기`}
      className="absolute inset-0"
    />
  );
}

/** Plain tag — the explanation lives on the column header (see `Column.hint`). */
function LifecycleCell({ row }: { row: RequestListRow }): ReactElement {
  return (
    <span role="cell" className={rq.lifecycle}>
      {row.installationLifecycleStatus ? (
        <InstallationLifecycleTag status={row.installationLifecycleStatus} plain />
      ) : (
        '—'
      )}
    </span>
  );
}

/** 대기 경과 셀. 날짜가 없으면 일수도 없다 — 0일이라고 말하지 않는다. */
function WaitCell({ since }: { since: string | null | undefined }): ReactElement {
  if (!since) return <span role="cell" className={rq.wait}>—</span>;
  const days = waitedDays(since);
  return (
    <span role="cell" className={rq.wait}>
      <span className={days >= WAIT_WARN_DAYS ? accessStyles.benchWaitHot : accessStyles.benchWait}>
        {days}일
      </span>
    </span>
  );
}

/** What the rail says about a view, and what the card shows when it is picked. */
interface ViewMeta {
  /** 레일 항목 라벨 — 카드 제목보다 짧다. 레일은 168px 한 칸이다. */
  rail: string;
  title: string;
  desc: string;
  tone: SectionTone;
  columns: readonly Column[];
  empty: { title: string; caption: string };
  /**
   * Floor for the rows block, for a view whose columns cannot all fit the card
   * at the 1080 shell floor. Set it and the card scrolls sideways instead of
   * squeezing the cells; leave it off and the columns share what there is.
   *
   * It goes on the rows block, not on the scroller: a block's scrollWidth is
   * its box width, so without a min-width on the INNER element there is nothing
   * to overflow and the scroller never engages.
   */
  rowsMinWidth?: string;
}

const VIEW_META: Record<RequestView, ViewMeta> = {
  pending: {
    rail: '승인 대기',
    title: '연동 요청 확인',
    desc: '승인이 필요한 연동 요청이에요 — 검토 후 승인하거나 반려해 주세요',
    tone: 'primary',
    columns: PENDING_COLUMNS,
    rowsMinWidth: ACTION_ROWS_MIN_WIDTH,
    empty: {
      title: '승인을 기다리는 요청이 없어요',
      caption: '새 연동 요청이 들어오면 여기에 표시돼요',
    },
  },
  rejected: {
    rail: '반려 미확인',
    title: '연동 요청 반려 확인',
    desc: '반려했으나 서비스 측 담당자가 아직 확인하지 않았어요 — 행을 눌러 사유와 요청 내역을 볼 수 있어요',
    tone: 'danger',
    columns: REJECTED_COLUMNS,
    rowsMinWidth: ACTION_ROWS_MIN_WIDTH,
    empty: {
      title: '확인 대기 중인 반려 건이 없어요',
      caption: '반려 처리한 요청이 여기에 모여요',
    },
  },
  recent: {
    // 앞 두 항목은 상태의 이름이고 이것은 기간의 이름이다. 창 길이를 라벨에 적는
    // 이유는 운영 알림 타일과 같다 — '최근'만으로는 며칠인지 화면 어디에도 없고,
    // 창은 서버가 고정해 두어 사용자가 바꿀 수 없다. 두 화면이 같은 목록을 같은
    // 이름으로 부른다.
    rail: '최근 14일 생성',
    title: '최근 생성 대상 확인',
    desc: '최근 14일 이내에 만들어진 연동 대상이에요 — 행을 눌러 지금 어디까지 왔는지 볼 수 있어요',
    tone: 'muted',
    columns: RECENT_COLUMNS,
    rowsMinWidth: 'min-w-[598px]',
    empty: {
      title: '최근 14일 안에 만들어진 대상이 없어요',
      caption: '새 연동 대상이 만들어지면 여기에 표시돼요',
    },
  },
  history: {
    rail: '전체 이력',
    title: '전체 History 확인',
    desc: '모든 연동 요청의 승인 처리 이력이에요',
    tone: 'muted',
    columns: HISTORY_COLUMNS,
    /**
     * 730 = 고정 열 합(service 72 + code 76 + target 48 + cloud 72 + status 116
     * + actor 112 + when 136 + chev 14 = 646) + gap 7칸 × 12. 여덟 열은 바닥(1080)의 카드
     * 안쪽 558 에 안 들어간다 — 그때 줄어드는 것은 **일시**였고(101 상자에 119 잉크),
     * 분 단위가 조용히 사라졌다. 이력의 일이 "언제 일어났나" 하나인데 그 값의 정밀도를
     * 말없이 버리는 것은 밀도 절충이 아니라 데이터 결함이다. 좁으면 옆으로 민다.
     *
     */
    rowsMinWidth: 'min-w-[730px]',
    empty: {
      title: '표시할 승인 이력이 없어요',
      caption: '연동 요청이 처리되면 이력이 여기에 쌓여요',
    },
  },
};

/** 레일의 두 묶음 — 해야 할 일과 남은 기록. */
const RAIL_GROUPS: readonly { title: string; views: readonly RequestView[] }[] = [
  { title: '작업', views: ['pending', 'rejected', 'recent'] },
  { title: '기록', views: ['history'] },
];

interface RailItemProps {
  view: RequestView;
  selected: boolean;
  /** null = 아직 첫 페이지가 오지 않았다. 0 이라고 말하지 않는다. */
  count: number | null;
  onSelect: (view: RequestView) => void;
}

function RailItem({ view, selected, count, onSelect }: RailItemProps): ReactElement {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={() => onSelect(view)}
      className={cn(rq.railItem, selected ? rq.railItemActive : rq.railItemIdle)}
    >
      <span className={rq.railItemLabel}>{VIEW_META[view].rail}</span>
      {count != null && <span className={rq.railCount}>{count.toLocaleString()}</span>}
    </button>
  );
}

interface ViewCardProps<T> {
  meta: ViewMeta;
  state: PagedSection<T>;
  children: (rows: T[]) => ReactNode;
}

/** The one table card — header (title + 건수) / desc / column head / body /
 *  pager pinned to the bottom. */
function ViewCard<T>({ meta, state, children }: ViewCardProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = state;
  const { title, desc, tone, columns, empty, rowsMinWidth } = meta;
  const rows = paged?.content ?? [];

  return (
    <section className={rq.card} aria-label={title}>
      <div className={rq.head}>
        <h2 className={rq.title}>{title}</h2>
        {/* 로딩 중에는 숨긴다 — 스켈레톤 여덟 줄 옆에서 '0건'은 아직 모르는
            수를 아는 척 단언하는 것이다. */}
        {paged != null && (
          <span className={cn(rq.badge, TONE_BADGE[tone])}>
            {paged.totalElements.toLocaleString()}건
          </span>
        )}
      </div>
      <p className={rq.desc}>{desc}</p>

      {/* The rows are flex divs (a <tr> can't host the absolutely positioned
          row-link overlay reliably), so the table semantics are declared: a
          screen reader reads "서비스 코드: STL", not a bare "STL". Every branch
          below stays a row inside this table — including the message states. */}
      <div className={pipelineStyles.card.tableWrap}>
        <div role="table" aria-label={`${title} 목록`} className={rowsMinWidth}>
          <div className={rq.headRow} role="row">
            {columns.map((col) => (
              <span key={col.label ?? 'tail'} role="columnheader" className={col.className}>
                {col.label}
                {col.hint}
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
            // real column widths) — the card holds its size through the load.
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

/** 두 작업 뷰의 행은 같은 골격이다 — 두 번째 flex 컬럼에 들어갈 값과, 대기·일자가
 *  읽는 날짜만 다르다. 행 전체가 P3 연동 요청 상세로 가고, 사유 전문과 요청
 *  내역(리소스)도 승인·반려 버튼과 함께 그 화면에서 읽는다. */
const actionRows = (
  rows: RequestListRow[],
  note: (row: RequestListRow) => string | null | undefined,
  when: (row: RequestListRow) => string | null | undefined,
): ReactNode =>
  rows.map((row) => {
    const id = row.targetSourceId;
    return (
      <div key={id ?? row.serviceCode} role="row" className={cn(rq.row, id != null && rq.rowLink)}>
        <span role="cell" className={cn(rq.service, rq.serviceName)}>
          {id != null && <RowLink id={id} serviceName={row.serviceName} to="request" />}
          {row.serviceName ?? '—'}
        </span>
        <span role="cell" className={cn(rq.code, rq.mono)}>
          {row.serviceCode ?? '—'}
        </span>
        <span role="cell" className={rq.cloud}>
          <ProvTag
            provider={row.cloudProvider ?? ''}
            isSdu={row.isSduType}
            isChina={row.isChinaRegion}
          />
        </span>
        <LifecycleCell row={row} />
        {/* 미리보기 한 줄. 전문은 행을 눌러 연동 요청 상세에서 —
            hover 툴팁은 두지 않는다: 툴팁을 띄우려면 이 셀이 포인터를 받아야 하고,
            그러면 같은 자리에서 행 링크 클릭이 죽는다. */}
        <span role="cell" className={rq.note}>
          {note(row) ?? '—'}
        </span>
        <WaitCell since={when(row)} />
        <span role="cell" className={rq.when}>
          {fmtDateTime(when(row))}
        </span>
        <span role="cell" className={rq.chev}>
          <Icon name="arrow-up-right" size="sm" />
        </span>
      </div>
    );
  });

export interface RequestsViewProps {
  /** `?view=` 가 고른 뷰 — 서버 셸이 검증해 내려준다. */
  initialView: RequestView;
}

export function RequestsView({ initialView }: RequestsViewProps): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);
  const recent = usePagedSection(fetchRecent);

  const [view, setView] = useState<RequestView>(initialView);

  // The URL is kept in sync so a view is linkable/shareable and survives reload.
  // history.replaceState (not router.replace) because picking a view is a filter,
  // not a navigation: no server round trip, no history entry, no scroll reset.
  const selectView = useCallback((next: RequestView) => {
    setView(next);
    window.history.replaceState(null, '', `${window.location.pathname}?view=${next}`);
  }, []);

  // 작업 묶음 세 뷰가 모두 도착해야 합이 사실이다 — 하나라도 로딩 중이면 수를 말하지
  // 않는다(스켈레톤 옆에서 32px 볼드로 부분합은 모르는 값을 아는 척하는 것).
  const counted = pending.paged != null && rejected.paged != null && recent.paged != null;
  const todo =
    (pending.paged?.totalElements ?? 0) +
    (rejected.paged?.totalElements ?? 0) +
    (recent.paged?.totalElements ?? 0);

  const counts: Record<RequestView, number | null> = {
    pending: pending.paged?.totalElements ?? null,
    rejected: rejected.paged?.totalElements ?? null,
    history: history.paged?.totalElements ?? null,
    recent: recent.paged?.totalElements ?? null,
  };

  return (
    <div className={rq.page}>
      <div className={rq.body}>
        <h1 className={rq.h1}>연동 요청</h1>
        {/* 갓 만들어진 대상은 '서비스가 보낸 승인 요청'이 아니다 — 세 집단을 한
            수로 접는 이 줄은 셋이 공유하는 것만 말한다: 확인이 필요한 대상. */}
        <p className={rq.context}>
          확인이 필요한 대상이 총
          {counted ? (
            <strong className={rq.contextTotal}>{todo}</strong>
          ) : (
            <span className={rq.contextSkeleton} />
          )}
          건 있어요
        </p>

        <div className={rq.split}>
          <nav className={rq.rail} aria-label="연동 요청 보기">
            {RAIL_GROUPS.map((group) => (
              <div key={group.title} className={rq.railGroup}>
                <span className={rq.railTitle}>{group.title}</span>
                {group.views.map((v) => (
                  <RailItem
                    key={v}
                    view={v}
                    selected={v === view}
                    count={counts[v]}
                    onSelect={selectView}
                  />
                ))}
              </div>
            ))}
          </nav>

          {view === 'pending' ? (
            <ViewCard meta={VIEW_META.pending} state={pending}>
              {(rows) =>
                actionRows(
                  rows,
                  (row) => row.description,
                  (row) => row.latestApprovalRequest?.requestedAt,
                )
              }
            </ViewCard>
          ) : view === 'rejected' ? (
            <ViewCard meta={VIEW_META.rejected} state={rejected}>
              {(rows) =>
                actionRows(
                  rows,
                  (row) => row.latestApprovalRequest?.reason,
                  (row) => row.latestApprovalRequest?.processedAt,
                )
              }
            </ViewCard>
          ) : view === 'recent' ? (
            /* 최근 생성 — 승인 흐름과 무관한 목록이라 대기 알약도, 요청 일자도 없다.
               행이 말하는 날짜는 하나뿐이다: 이 대상이 생긴 날. */
            <ViewCard meta={VIEW_META.recent} state={recent}>
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
                        {id != null && <RowLink id={id} serviceName={row.serviceName} />}
                        {row.serviceName ?? '—'}
                      </span>
                      <span role="cell" className={cn(rq.code, rq.mono)}>
                        {row.serviceCode ?? '—'}
                      </span>
                      <span role="cell" className={rq.cloud}>
                        <ProvTag
                          provider={row.cloudProvider ?? ''}
                          isSdu={row.isSduType}
                          isChina={row.isChinaRegion}
                        />
                      </span>
                      <LifecycleCell row={row} />
                      <span role="cell" className={rq.note}>
                        {row.description ?? '—'}
                      </span>
                      <span role="cell" className={rq.when}>
                        {fmtDateTime(row.createdAt)}
                      </span>
                      <span role="cell" className={rq.chev}>
                        <Icon name="arrow-up-right" size="sm" />
                      </span>
                    </div>
                  );
                })
              }
            </ViewCard>
          ) : (
            /* 전체 이력 — 승인 처리 기록. key 는 historyRecordId (유일).
               targetSourceId·requestId 는 반복될 수 있어 key 로 못 쓴다.
               id 가 없는 행은 갈 곳이 없다 — 링크도, 꼬리 잉크도, hover 도 없다.
               죽은 링크를 그리느니 그 행만 안 움직이는 편이 정직하다. */
            <ViewCard meta={VIEW_META.history} state={history}>
              {(rows) =>
                rows.map((row) => {
                  const id = row.targetSourceId;
                  return (
                  <div
                    key={row.historyRecordId ?? `${row.targetSourceId}:${row.requestId}`}
                    role="row"
                    className={cn(rq.row, id != null && rq.rowLink)}
                  >
                    <span role="cell" className={cn(rq.service, rq.serviceName)}>
                      {id != null && <RowLink id={id} serviceName={row.serviceName} />}
                      {row.serviceName ?? '—'}
                    </span>
                    <span role="cell" className={cn(rq.code, rq.mono)}>
                      {row.serviceCode ?? '—'}
                    </span>
                    <span role="cell" className={cn(rq.target, rq.mono)}>
                      {row.targetSourceId != null ? `#${row.targetSourceId}` : '—'}
                    </span>
                    <span role="cell" className={rq.cloud}>
                      <ProvTag
                        provider={row.cloudProvider ?? ''}
                        isSdu={row.isSduType}
                        isChina={row.isChinaRegion}
                      />
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
                    <span role="cell" className={rq.chev}>
                      {id != null && <Icon name="arrow-up-right" size="sm" />}
                    </span>
                  </div>
                  );
                })
              }
            </ViewCard>
          )}
        </div>
      </div>
    </div>
  );
}
