'use client';

import { useState, useSyncExternalStore } from 'react';
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
import { InfrastructureEmptyState } from '@/app/components/features/admin/infrastructure/InfrastructureEmptyState';
import { InfraRow, type InfraRowAction } from '@/app/components/features/admin/v7/InfraRow';

interface InfraRowListProps {
  /** `null` until the request resolves — `[]` is the answer "there are none". */
  projects: ProjectSummary[] | null;
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: InfraRowAction, targetSourceId: number) => void;
}

/** Never changes, so the store never notifies — this is a constant, not a subscription. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

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
  <div className="flex flex-1 flex-col gap-3.5" aria-busy="true">
    <div className="flex items-center gap-2 pl-1 pb-3">
      <div className={cn(idcStyles.skeletonBar, 'h-5 w-[86px] rounded')} />
      <div className={cn(idcStyles.skeletonBar, 'h-[22px] w-[44px] rounded-full')} />
    </div>

    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
      <div
        key={i}
        aria-hidden="true"
        className={cn(
          'flex items-start gap-3.5 px-[21px] py-[19px] rounded-[12px] border',
          bgColors.surface,
          borderColors.default,
        )}
      >
        <div className={cn(idcStyles.skeletonBar, 'h-16 w-16 shrink-0 rounded-[12px]')} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className={cn(idcStyles.skeletonBar, 'h-6 w-[300px] max-w-full rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-[21px] w-[240px] max-w-full rounded')} />
          <div className={cn(idcStyles.skeletonBar, 'h-[21px] w-[440px] max-w-full rounded')} />
        </div>
        <div className={cn(idcStyles.skeletonBar, 'self-center h-8 w-8 shrink-0 rounded')} />
      </div>
    ))}

    <div className={cn('mt-auto shrink-0 h-[52px] border-t', borderColors.light)} />
  </div>
);

export const InfraRowList = ({
  projects,
  loading,
  onAddInfra,
  onOpenDetail,
  onManageAction,
}: InfraRowListProps) => {
  const [page, setPage] = useState(0);
  // "We are loading" is client state — the server has no idea whether a request it
  // never made is in flight, so it must not render a loading frame. Rendering the
  // skeleton during SSR left this subtree's hydration stalled: the server HTML
  // painted, the effects never ran, and the list sat in skeleton forever.
  //
  // `useSyncExternalStore` rather than setState-in-an-effect: it is the one hook
  // that is allowed to answer differently on the server and on the client, so the
  // hydrating render already agrees with the server instead of correcting it.
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  // Nothing has resolved yet — draw the page's shape rather than an answer about it.
  // Gated on the data, not on `loading`: `loading` is set from an effect, so it is
  // still false on the first painted frame and this list would flash 등록된 계정이
  // 없어요 before the request was even in flight.
  if (projects === null) return mounted ? <InfraRowListSkeleton /> : null;

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  // Clamp at render rather than resetting in an effect, which would paint one
  // out-of-range frame first.
  const safePage = Math.min(page, totalPages - 1);
  const visible = projects.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // A refresh that emptied the list, or one starting from empty — same frame as the
  // first load, so it draws the same thing. A centred spinner on a page-sized column
  // said "wait" without saying what for.
  if (loading && projects.length === 0) return mounted ? <InfraRowListSkeleton /> : null;

  if (projects.length === 0) {
    return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
  }

  return (
    // `flex-1` + the pager's `mt-auto`: the pager sits on the bottom edge of the
    // column instead of trailing the last card. On a 1/1 page it was floating in
    // the middle of the screen with the rule under it cutting the canvas in half.
    <div className="flex flex-1 flex-col gap-3.5" aria-busy={loading}>
      {/* No bar chrome: the cards below already own every edge on this column, so a
          bordered toolbar would draw a frame around nothing. The count describes this
          list, not the service, which is why it lives here and not in the page header. */}
      <div className={cn('flex items-center gap-2 pl-1 pb-3 text-[14px]', textColors.secondary)}>
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

      {visible.map((project) => (
        <InfraRow
          key={project.id}
          project={project}
          onManageAction={onManageAction}
          onOpenDetail={onOpenDetail}
        />
      ))}

      <div
        className={cn(
          'mt-auto flex shrink-0 items-center justify-center gap-5 h-[52px] border-t',
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
