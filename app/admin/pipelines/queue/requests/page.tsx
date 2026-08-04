'use client';

/**
 * P2 연동 요청 목록 (/admin/pipelines/queue/requests) — design-spec §2.
 *
 * Three sections, ranked by what the operator has to act on: 연동 요청 확인
 * (PENDING) and 연동 요청 반려 확인 (REJECTED) sit side by side above the fold,
 * 전체 History 확인 (approval-history) is the read-only audit log below them.
 *
 * Density grammar is the 운영 알림 stage card's (ops/alerts/_components/
 * AlertStageCard): 17px title + 건수 badge inline, one 13px desc line, flex rows
 * at py-2.5, a fixed page of rows, and an always-rendered pager pinned to the
 * card bottom so the two top cards keep the same height whatever they hold.
 * Each section reads its own source and paginates independently (server page
 * param, 0-based). Only the PENDING rows navigate — the rejected list keeps its
 * 반려 사유 hover cell, and the history log is not clickable.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';

import Link from 'next/link';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { RejectReasonCell } from '@/app/admin/pipelines/queue/_components/bits';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';
import { getApprovalHistory, getRequestList } from '@/app/lib/api/task-queue-requests';
import type { ApprovalHistoryRow, Paged, RequestListRow } from '@/lib/types/task-queue';

/** 5 rows is the card body height the three sections share (min-h-[360px]). */
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

/** Visual tone of a section — drives its 건수 badge only; the two action cards
 *  read as primary/danger, the audit log as neutral. */
type SectionTone = 'primary' | 'danger' | 'muted';

const TONE_BADGE: Record<SectionTone, string> = {
  primary: 'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
  danger: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  muted: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
};

const rq = {
  context: 'mt-1 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  contextTotal: 'mx-0.5 align-baseline text-[32px] font-bold leading-none text-[var(--pl-primary)]',
  grid: 'mt-6 grid grid-cols-2 gap-6',

  // shadow-md: 카드가 3장뿐이고 2단으로 붙어 있어 xs/sm 으로는 경계가 배경에
  // 묻는다. lg 는 모달/툴팁 높이라 얹혀 있는 카드가 떠 보인다.
  // 외곽선만 border-strong — 내부 행 구분선은 --pl-border 를 유지해야 카드
  // 경계와 행 경계가 같은 굵기로 읽히지 않는다.
  card: 'flex min-h-[360px] flex-col rounded-[12px] border border-[var(--pl-border-strong)] bg-[var(--pl-bg-card)] p-4 shadow-[var(--pl-shadow-md)]',
  head: 'flex items-center justify-between gap-3',
  titleWrap: 'flex items-center gap-2',
  titleIcon: 'text-[var(--pl-text-medium)]',
  title: 'text-[17px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  badge: 'inline-flex flex-none items-center rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums',
  desc: 'mt-1.5 text-[13px] leading-[1.5] text-[var(--pl-gray-600)]',

  headRow: 'mt-3 flex items-center gap-3 py-2 text-[12px] font-medium text-[var(--pl-text-faint)]',
  row: 'group relative flex items-center gap-3 border-t border-[var(--pl-border)] py-2.5 text-[13px] text-[var(--pl-text-medium)] transition-colors',
  rowLink: 'hover:bg-[var(--pl-gray-50)]',

  /**
   * Column widths — shared by a section's header row and its data rows.
   *
   * The two top cards run the SAME skeleton (service · code · target · cloud ·
   * note · when · tail) so their columns line up across the grid gutter. That
   * means the same COUNT of flex-1 columns too: `service` and `note` both grow,
   * so each card splits its slack the same way. Give one card an extra flexible
   * column and its 서비스 이름 silently shrinks to half the other's.
   */
  service: 'min-w-0 flex-1 truncate',
  serviceName: 'font-medium text-[var(--pl-text-strong)]',
  code: 'w-[96px] flex-none truncate',
  mono: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  target: 'w-[56px] flex-none',
  cloud: 'w-[76px] flex-none',
  note: 'min-w-0 flex-1 truncate',
  // overflow-hidden(truncate) 필수 — 상태 pill 라벨 중 'UNAVAILABLE_ACKNOWLEDGED'
  // 는 25자라 어떤 컬럼 폭도 넘긴다. flex-none 셀은 넘친 내용이 옆 컬럼을 밀지
  // 않고 그 위에 겹쳐 그려지므로, 잘라서 행을 지킨다.
  status: 'w-[104px] flex-none min-w-0 truncate',
  actor: 'w-[120px] flex-none truncate',
  // 124 = 'YYYY-MM-DD HH:mm' at 13px tabular + slack; narrower and the nowrap
  // timestamp pushes the row wider than its card.
  when: 'w-[124px] flex-none whitespace-nowrap tabular-nums text-[var(--pl-text-weak)]',
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

/** The two action cards share one skeleton — same widths, same flex-1 count —
 *  so their columns line up across the grid gutter. Only the note/date labels
 *  differ. */
const actionColumns = (note: string, when: string): readonly Column[] => [
  { label: '서비스 이름', className: rq.service },
  { label: '서비스 코드', className: rq.code },
  { label: 'Target', className: rq.target },
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

interface SectionCardProps<T> {
  title: string;
  desc: string;
  icon: IconName;
  tone: SectionTone;
  state: PagedSection<T>;
  /** Drives BOTH the header row and the loading skeleton, so the two can never
   *  drift from the widths the data rows use. */
  columns: readonly Column[];
  empty: { title: string; caption: string };
  children: (rows: T[]) => ReactNode;
  className?: string;
}

/** Section card shell — header (icon + title + 건수) / desc / column head /
 *  body / pager pinned to the bottom. */
function SectionCard<T>({
  title,
  desc,
  icon,
  tone,
  state,
  columns,
  empty,
  children,
  className,
}: SectionCardProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = state;
  const rows = paged?.content ?? [];

  return (
    <section className={cn(rq.card, className)} aria-label={title}>
      <div className={rq.head}>
        <div className={rq.titleWrap}>
          <Icon name={icon} size={20} className={rq.titleIcon} />
          <h2 className={rq.title}>{title}</h2>
        </div>
        <span className={cn(rq.badge, TONE_BADGE[tone])}>
          {(paged?.totalElements ?? 0).toLocaleString()}건
        </span>
      </div>
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
            <div role="cell" className={rq.state}>
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
            <div role="cell" className={rq.empty}>
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

export default function RequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);

  const todo = (pending.paged?.totalElements ?? 0) + (rejected.paged?.totalElements ?? 0);

  return (
    <div>
      <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--pl-text-strong)]">
        연동 요청
      </h1>
      <p className={rq.context}>
        서비스가 보낸 연동 승인 요청 중 확인이 필요한 건이 총
        <strong className={rq.contextTotal}>{todo}</strong>건 있어요
      </p>

      <div className={rq.grid}>
        {/* 연동 요청 확인 (승인 대기) — 행 전체가 상세로 가는 링크. */}
        <SectionCard
          title="연동 요청 확인"
          desc="승인이 필요한 연동 요청이에요 — 검토 후 승인하거나 반려해 주세요"
          icon="inbox"
          tone="primary"
          state={pending}
          empty={{ title: '승인을 기다리는 요청이 없어요', caption: '새 연동 요청이 들어오면 여기에 표시돼요' }}
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
                  {id != null && (
                    <Link
                      href={passRoutes.pipelines.queue.request(id)}
                      aria-label={`${row.serviceName ?? `Target Source ${id}`} 연동 요청 상세 보기`}
                      className="absolute inset-0"
                    />
                  )}
                  <span role="cell" className={cn(rq.service, rq.serviceName)}>
                    {row.serviceName ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.code, rq.mono)}>
                    {row.serviceCode ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.target, rq.mono)}>
                    {id != null ? `#${id}` : '—'}
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
                    <Icon name="chev-r" size="sm" />
                  </span>
                </div>
              );
            })
          }
        </SectionCard>

        {/* 연동 요청 반려 확인 (반려) — 위 카드와 같은 컬럼 골격. 반려 사유가
            설명 자리(유일한 두 번째 flex 컬럼)에 들어가고, 잘린 전문은 기존
            hover 셀(tqStyles.rr)이 그대로 보여준다. */}
        <SectionCard
          title="연동 요청 반려 확인"
          desc="반려했으나 서비스 측 담당자가 아직 확인하지 않았어요"
          icon="warn-tri"
          tone="danger"
          state={rejected}
          empty={{ title: '확인 대기 중인 반려 건이 없어요', caption: '반려 처리한 요청이 여기에 모여요' }}
          columns={REJECTED_COLUMNS}
        >
          {(rows) =>
            rows.map((row) => {
              const id = row.targetSourceId;
              return (
                <div key={id ?? row.serviceCode} role="row" className={rq.row}>
                  <span role="cell" className={cn(rq.service, rq.serviceName)}>
                    {row.serviceName ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.code, rq.mono)}>
                    {row.serviceCode ?? '—'}
                  </span>
                  <span role="cell" className={cn(rq.target, rq.mono)}>
                    {id != null ? `#${id}` : '—'}
                  </span>
                  <span role="cell" className={rq.cloud}>
                    <ProvTag provider={row.cloudProvider ?? ''} />
                  </span>
                  <span role="cell" className={rq.note}>
                    {/* 오른쪽 카드라 툴팁은 왼쪽으로 펼친다 — 기본(left)이면 카드 밖. */}
                    <RejectReasonCell
                      reason={row.latestApprovalRequest?.reason ?? '—'}
                      align="right"
                    />
                  </span>
                  <span role="cell" className={rq.when}>
                    {fmtDateTime(row.latestApprovalRequest?.processedAt)}
                  </span>
                  {/* 반려 행은 상세로 가지 않는다 — 위 카드의 › 자리를 비워 폭만 맞춘다. */}
                  <span role="cell" className={rq.chev} />
                </div>
              );
            })
          }
        </SectionCard>
      </div>

      {/* 전체 History 확인 (approval-history) — read-only audit log, 보조 역할이라
          두 카드 아래 전체 폭 한 장. key 는 historyRecordId (유일). targetSourceId·
          requestId 는 반복될 수 있어 key 로 못 쓴다. */}
      <SectionCard
        className="mt-6"
        title="전체 History 확인"
        desc="모든 연동 요청의 승인 처리 이력이에요"
        icon="clock"
        tone="muted"
        state={history}
        empty={{ title: '표시할 승인 이력이 없어요', caption: '연동 요청이 처리되면 이력이 여기에 쌓여요' }}
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
      </SectionCard>
    </div>
  );
}
