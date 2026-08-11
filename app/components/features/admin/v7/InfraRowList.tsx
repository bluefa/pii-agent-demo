'use client';

import { useState } from 'react';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import { Button } from '@/app/components/ui/Button';
import { InfraRow, type InfraRowAction } from '@/app/components/features/admin/v7/InfraRow';

interface InfraRowListProps {
  /** `null` until the request resolves — `[]` is the answer "there are none". */
  projects: ProjectSummary[] | null;
  /** Why the request failed, or `null`. Takes precedence: a failure is not an answer. */
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: InfraRowAction, targetSourceId: number) => void;
}

/**
 * Five cards a page, not ten. Each card carries the account id, its identifying
 * metadata and the description — reading one takes real attention, so the page holds
 * fewer of them.
 */
const PAGE_SIZE = 5;

/**
 * The list's loading frame. Every measurement is copied from the settled markup
 * rather than eyeballed — card `px-[21px] py-[19px]`, the 64px provider mark, the
 * text column's `gap-1.5`, the header's 22px pill, the 52px pager strip, and
 * PAGE_SIZE cards — because a skeleton that guesses its own sizes reintroduces
 * exactly the reflow it exists to prevent.
 *
 * Deliberately blank: the count pill's number and the pager's arrows. Both state
 * facts that are not known yet, and a skeleton must not answer a question.
 */
const InfraRowListSkeleton = () => (
  // `role="status"` + a named region: `aria-busy` is a property, not a live region, and
  // every bar below is aria-hidden — without this a screen reader hears nothing at all
  // between picking a service and the rows arriving.
  <div className="flex flex-1 min-h-0 flex-col" role="status" aria-busy="true" aria-label="연동 대상 계정 목록을 불러오는 중">
    <div className="flex shrink-0 items-center gap-2 pl-1 pb-3">
      <div className={cn(idcStyles.skeletonBar, 'h-5 w-[86px] rounded')} />
      <div className={cn(idcStyles.skeletonBar, 'h-[22px] w-[44px] rounded-full')} />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto -mx-1 flex flex-col gap-3.5 px-1 pb-1">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            'flex shrink-0 items-center gap-3.5 px-[21px] py-[19px] rounded-[12px] border',
            bgColors.surface,
            // The settled card's border, not `default` — they are ΔE00 4.20 apart, so the
            // outline visibly changed tone when the data landed.
            borderColors.card,
          )}
        >
          <div className={cn(idcStyles.skeletonBar, 'h-16 w-16 shrink-0 rounded-[12px]')} />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className={cn(idcStyles.skeletonBar, 'h-6 w-[300px] max-w-full rounded')} />
            <div className={cn(idcStyles.skeletonBar, 'h-[21px] w-[240px] max-w-full rounded')} />
            <div className={cn(idcStyles.skeletonBar, 'h-[21px] w-[440px] max-w-full rounded')} />
          </div>
          <div className={cn(idcStyles.skeletonBar, 'h-8 w-8 shrink-0 rounded')} />
        </div>
      ))}
    </div>

    <div className={cn('shrink-0 h-[52px] border-t', borderColors.light)} />
  </div>
);

/**
 * A fetch that failed, which is NOT the same screen as a service with no accounts.
 * The empty slot asserts a fact about the service — after a 500 that claim is
 * unfounded, since accounts we simply could not read may already exist. The toast
 * that announced the failure is gone by the time the user reads this, so the
 * recovery has to live here.
 */
const InfraRowListError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
    <p className={cn('text-[16px] font-medium', textColors.primary)}>
      연동 대상 계정을 불러오지 못했습니다
    </p>
    <p className={cn('text-[14px]', textColors.secondary)}>{message}</p>
    <Button variant="secondary" onClick={onRetry} className="mt-2">
      다시 시도
    </Button>
  </div>
);

export const InfraRowList = ({
  projects,
  error,
  loading,
  onRetry,
  onOpenDetail,
  onManageAction,
}: InfraRowListProps) => {
  const [page, setPage] = useState(0);

  if (error !== null) return <InfraRowListError message={error} onRetry={onRetry} />;

  // Nothing has resolved yet — draw the page's shape rather than an answer about it.
  // Gated on the data, not on `loading`: `loading` is set from an effect, so it is
  // still false on the first painted frame and this list would flash 등록된 연동
  // 대상이 없습니다 before the request was even in flight.
  //
  // Server-rendered, deliberately. This used to hide behind a client-mount gate so the
  // server drew nothing, on the theory that an SSR skeleton stalled hydration — that
  // was misdiagnosed against a corrupted Turbopack cache. The cost was the whole point
  // of the skeleton: on entry the server painted a header over an empty column, and the
  // fetch beat hydration, so nobody ever saw the loading frame this component exists to
  // be. `projects === null` is true on the server for the same reason it is true on the
  // client's first render — nothing has been fetched — so both agree and there is no
  // mismatch to correct.
  if (projects === null) return <InfraRowListSkeleton />;

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  // Clamp at render rather than resetting in an effect, which would paint one
  // out-of-range frame first.
  const safePage = Math.min(page, totalPages - 1);
  const visible = projects.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // A refresh that emptied the list, or one starting from empty — same frame as the
  // first load, so it draws the same thing. A centred spinner on a page-sized column
  // said "wait" without saying what for.
  if (loading && projects.length === 0) return <InfraRowListSkeleton />;

  return (
    // Three bands: a fixed heading, a scrolling middle, a fixed pager. Only the
    // middle band scrolls, so the pager is a real footer — it never covers a card,
    // which a `sticky` bar did by definition (the cards ran underneath it).
    //
    // `min-h-[228px]` is the floor at which one whole card still shows between the two
    // fixed bands. Without it the middle band, being the only `min-h-0` child, absorbs
    // every pixel of a short window and the list becomes a heading over a pager with
    // "1/2 페이지" under it and no card in sight. At the floor the column overflows
    // instead, and `main`'s `overflow-y-auto` gives the page back its scroll.
    // It replaces `min-h-0` rather than joining it: a floor above zero still lets this
    // shrink below its content height, which is all `min-h-0` was buying.
    <div className="flex flex-1 min-h-[228px] flex-col" aria-busy={loading}>
      {/* No bar chrome: the cards below already own every edge on this column, so a
          bordered toolbar would draw a frame around nothing. The count describes this
          list, not the service, which is why it lives here and not in the page header. */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 pl-1 pb-3 text-[14px]',
          textColors.secondary,
        )}
      >
        연동 대상 계정
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[12px] font-bold',
            primaryColors.bgLight,
            primaryColors.textOnLight,
            numericFeatures.tabular,
          )}
        >
          {projects.length}건
        </span>
      </div>

      {/* The only scrolling element on the page. `min-h-0` because a flex child's
          default `min-height:auto` refuses to shrink below its content — without it
          this band grows to fit all five cards and pushes the footer back off-screen,
          which is the bug this replaced. `px-*`/`-mx-*` so a card's focus ring and
          hover edge are not clipped by the scrollport. */}
      <div className="min-h-0 flex-1 overflow-y-auto -mx-1 flex flex-col gap-3.5 px-1 pb-1">
        {/* 0건일 때의 말은 카드가 놓일 자리가 맡는다. 목록 전체를 대체하는 카드로 두면
            (예전 InfrastructureEmptyState) 머리글도 페이저도 함께 사라져, 계정이 하나
            생기는 순간 화면 구조가 통째로 바뀐다 — 같은 목록의 두 상태가 아니라 서로
            다른 두 화면처럼 읽혔다.

            점선 한 겹으로만 말한다: 카드가 아니라 카드가 놓일 자리다. 채움용 슬롯을
            여러 장 깔지 않는 건 이 밴드가 이미 `flex-1` 로 높이를 잡고 있어서다 —
            운영 콘솔은 3장 고정 페이지라 나머지 슬롯이 높이를 지탱해야 했다. */}
        {visible.length === 0 ? (
          <div
            className={cn(
              'flex flex-1 items-center justify-center rounded-[12px] border border-dashed px-6 text-center text-[14px]',
              borderColors.strong,
              textColors.tertiary,
            )}
          >
            등록된 연동 대상이 없습니다
          </div>
        ) : (
          visible.map((project) => (
            <InfraRow
              key={project.id}
              project={project}
              onManageAction={onManageAction}
              onOpenDetail={onOpenDetail}
            />
          ))
        )}
      </div>

      {/* Footer band — outside the scrollport, so it is always on screen and always
          clear of the cards. It needs no background of its own for that reason. */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-center gap-5 h-[52px] border-t',
          borderColors.light,
        )}
      >
        <PageArrow
          label="이전 페이지"
          disabled={safePage <= 0}
          onClick={() => setPage(safePage - 1)}
        >
          ←
        </PageArrow>
        <span
          className={cn('text-[14px] font-medium', textColors.secondary, numericFeatures.tabular)}
        >
          {safePage + 1}/{totalPages} 페이지
        </span>
        <PageArrow
          label="다음 페이지"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage(safePage + 1)}
        >
          →
        </PageArrow>
      </div>
    </div>
  );
};

const PageArrow = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-grid w-9 h-9 place-items-center rounded-lg text-[18px] font-bold transition-colors',
      textColors.secondary,
      'disabled:opacity-35 disabled:cursor-not-allowed',
    )}
  >
    {children}
  </button>
);
