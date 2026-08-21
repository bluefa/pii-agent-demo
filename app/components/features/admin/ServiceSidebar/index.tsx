'use client';

import Link from 'next/link';

import { ServiceRow } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { ChevronRightIcon, CloseIcon, SearchIcon } from '@/app/components/ui/icons';
import type { PageServiceItem } from '@/app/lib/api';
import { passRoutes } from '@/lib/routes';
import {
  borderColors,
  bgColors,
  serviceSidebarStyles,
  textColors,
  cn,
  getInputClass,
} from '@/lib/theme';

interface ServicePageInfo {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

type ServiceItem = NonNullable<PageServiceItem['content']>[number];

/**
 * Ceiling for one stretched row. A full page divides the rail's height evenly, so
 * without a cap a tall monitor — or a two-row search result — would stretch each
 * row down the whole rail.
 */
const ROW_MAX_PX = 88;

/**
 * Rows per rail page — owned here, not by each caller.
 *
 * One page stays one screenful: the rail never scrolls *and* pages for the same
 * job, and eight rows sit at the top of the 7±2 range a user takes in as one
 * group. Rows divide the rail's height between them (ROW_MAX_PX caps how far),
 * so a page still reaches the bottom; ~100 services are 13 pages, and search
 * stays the primary lookup path.
 *
 * It lives with the sidebar because the number is a property of this rail, not
 * of the page hosting it — as two private copies it had already drifted to 10
 * on /services and 8 on /target-sources, giving the same rail different row
 * heights and page counts on two screens.
 */
export const SERVICE_RAIL_PAGE_SIZE = 8;

/** Skeleton row count — matches the page size so the list doesn't reflow when data lands. */
const SKELETON_ROWS = SERVICE_RAIL_PAGE_SIZE;

/** The service the surrounding page is about — marked in the list, not pinned above it. */
interface CurrentService {
  code: string;
  /** Absent while the name is still being resolved; the row falls back to the code. */
  name?: string;
}

interface ServiceSidebarProps {
  services: ServiceItem[];
  currentService: CurrentService | null;
  onSelectService: (code: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pageInfo: ServicePageInfo;
  onPageChange: (page: number) => void;
  /** While true, the list body shows skeleton rows — header/search/footer stay static. */
  loading?: boolean;
}

/**
 * The rail's one way out of "my service is not in this list". Both places that
 * say it — the no-access empty state and the standing hint at the rail's foot —
 * point at the same screen, so it is one control rendered twice rather than two
 * links that can drift apart.
 *
 * "권한 요청", not "권한 신청": the screen it opens is titled 내 권한 요청 and the
 * modal on it is 접근 권한 요청, so the action keeps one noun end to end.
 */
const RequestAccessLink = () => (
  <Link
    href={passRoutes.accessRequests}
    className={cn('inline-flex items-center gap-0.5', serviceSidebarStyles.emptyAction)}
  >
    권한 요청하기
    <ChevronRightIcon className="h-3.5 w-3.5" />
  </Link>
);

export const ServiceSidebar = ({
  services,
  currentService,
  onSelectService,
  searchQuery,
  onSearchChange,
  pageInfo,
  onPageChange,
  loading = false,
}: ServiceSidebarProps) => {
  const { totalElements } = pageInfo;

  // Every service the page returned is listed, including the current one — it is
  // marked in place rather than lifted out. Filtering it out only made sense while
  // a pinned band above the list repeated it.
  const listed = services;

  // Slots a short LAST page leaves empty. Rows divide the list's height, so the
  // last page of 20 services (four rows) stretched each of them to ROW_MAX_PX —
  // half again as tall as the same row on a full page — and still ended ~280px
  // above the bottom-docked pager. Holding the missing slots keeps a row a row
  // on every page and the pager where it already was.
  //
  // Only when the list is PAGED: a two-hit search is a short list, not a page
  // with holes in it, and padding it would invent rows that were never there.
  const emptySlots =
    !loading && listed.length > 0 && pageInfo.totalPages > 1
      ? Math.max(0, SERVICE_RAIL_PAGE_SIZE - listed.length)
      : 0;

  // Rows the ul will actually lay out — drives the height cap below.
  const rowCount = loading ? SKELETON_ROWS : listed.length + emptySlots;


  return (
    // v16 `.sidebar` — fixed 296px width (measured), shrink-0 so the main column owns the rest.
    //
    // Desktop rail grammar: one flush TINTED plane, zones divided by full-bleed
    // hairlines. The rail owns no padding — each zone sets its own, so the row
    // hover fills can run edge to edge. Tinted, not white: the rail is the back
    // plane and the content column is in front of it (see serviceSidebarStyles).
    <aside
      className={cn(
        'w-[296px] shrink-0 flex flex-col border-r',
        serviceSidebarStyles.surface,
        borderColors.default,
      )}
      aria-label="서비스 목록"
    >
      {/* Title + total. The pill is the rail's only count — during a search it is
          the hit count, which is why it is no longer hidden then.

          pt-6 matches the content column's `p-6`, so the rail's first line and
          the page's first line start on the same y. At pt-4 they sat 8px apart:
          near enough to read as a misalignment rather than as two zones. */}
      <div className="flex items-center gap-2 px-3 pt-6 pb-2.5">
        <h2 className={serviceSidebarStyles.title}>서비스 목록</h2>
        {!loading && totalElements > 0 && (
          <span className={serviceSidebarStyles.count}>{totalElements}</span>
        )}
      </div>

      {/* Search closes the rail's chrome block; the hairline under it opens the list. */}
      <div className={cn('px-3 py-2.5 border-b', serviceSidebarStyles.divider)}>
        {/* The relative box is the input itself, so the icons center on it — no
            offset math against the wrapper's padding. */}
        <div className="relative">
          <SearchIcon
            className={cn(
              'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2',
              textColors.quaternary,
            )}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="서비스 이름 또는 코드"
            aria-label="서비스 검색"
            className={cn(
              getInputClass(),
              // 32px control on a 6px radius: the shared input's 48px pill is form
              // geometry, and at rail width it reads as a mobile search bar. The
              // field keeps a visible edge instead of a fill — on a white plane the
              // border is what separates it, not elevation.
              '!h-8 !py-0 !pl-8 !pr-8 !rounded-[6px] text-sm [&::-webkit-search-cancel-button]:appearance-none',
              bgColors.surface,
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="검색어 지우기"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full cursor-pointer transition-colors',
                // tertiary, unlike the decorative magnifier: this glyph *is* the control,
                // and gray-400 is 2.5:1 on white — under WCAG 1.4.11's 3:1 for one.
                textColors.tertiary,
                bgColors.surfaceHover,
              )}
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* The list takes the rail's remaining height and its rows divide it evenly,
          so a page reaches the bottom rather than stopping halfway down. The
          footer rides directly under the last row, so nothing floats over dead
          space. On a short viewport the rows hold their min-height and the ul
          scrolls instead. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Only a FILTERED list gets a heading. Unfiltered it read "전체 서비스"
            directly under an h2 that already says "서비스 목록" with the total
            beside it — the same fact twice, costing a line of the rail. A search
            result is a different list, so that one still says so. */}
        {searchQuery && (loading || listed.length > 0) && (
          <div className={cn('px-3 pt-3 pb-1.5 shrink-0', serviceSidebarStyles.sectionLabel)}>
            검색 결과
          </div>
        )}

        <ul
          className={cn('flex-1 min-h-0 flex flex-col overflow-auto', serviceSidebarStyles.rowDivide)}
          // Rows divide the list's height, so a short page — or a tall monitor —
          // would stretch each row down the rail. Capping the list at
          // `rows × ROW_MAX_PX` stops the growth at a sane density; the footer
          // stays directly under the last row (it is the next sibling, not
          // bottom-docked), so any leftover height falls below the footer rather
          // than between it and the list.
          //
          // No cap with zero rows: the ul then holds the empty-state message,
          // and a `0` cap collapses it to nothing.
          style={rowCount > 0 ? { maxHeight: rowCount * ROW_MAX_PX } : undefined}
          aria-busy={loading}
        >
          {loading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              // Same flex-1 + min-height as a real row, so the list doesn't
              // reflow when the skeleton is replaced.
              <li
                key={i}
                className="flex flex-1 min-h-[48px] items-center gap-2.5 px-3"
                aria-hidden="true"
              >
                <div className={cn(serviceSidebarStyles.skeletonBar, 'h-7 w-7 shrink-0 rounded-[6px]')} />
                <div className={cn(serviceSidebarStyles.skeletonBar, 'h-3 flex-1 rounded')} />
                <div className={cn(serviceSidebarStyles.skeletonBar, 'h-5 w-10 shrink-0 rounded-[6px]')} />
              </li>
            ))
          ) : listed.length === 0 ? (
            // The rail states the fact and stops there. Naming the reason — and offering
            // the way out of it — is the CONTENT column's job when the account has access
            // to nothing (see ServiceManagementView): that pane is where the eye already
            // is, it has room for a sentence at 24px, and it is the surface that would
            // otherwise be telling the user to pick from this empty list. The standing
            // hint under the pager carries the link for every other case.
            //
            // Keyed off `listed`, not `services` — a page holding nothing but the current
            // service filters down to empty. Only quote a search term when there is one,
            // and keep the sentence page-scoped, since the filter is.
            <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              {/* Rail-scoped tokens, not the page-wide `tertiary`/`primary` pair: both of
                  those are measured against white and read 3.88:1 / 3.95:1 on this rail. */}
              <p className={serviceSidebarStyles.emptyText}>
                {searchQuery
                  ? `‘${searchQuery}’와 일치하는 서비스가 없습니다`
                  : '서비스가 없습니다'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className={cn('mt-2', serviceSidebarStyles.emptyAction)}
                >
                  검색어 지우기
                </button>
              )}
            </li>
          ) : (
            listed.map((service) => {
              const code = service.service_code ?? '';
              return (
                <ServiceRow
                  key={code}
                  code={code}
                  name={service.service_name ?? undefined}
                  onSelect={onSelectService}
                  current={code === currentService?.code}
                />
              );
            })
          )}

          {/* One spacer growing for all the missing slots, not one <li> each: the
              ul's `divide-y` would draw a hairline between every filler, and a
              stack of ruled empty rows reads as a list that failed to load. As a
              single sibling it takes exactly its slots' share of the height and
              carries one divider — the line that closes the list. */}
          {emptySlots > 0 && (
            <li aria-hidden="true" style={{ flex: `${emptySlots} 1 0%` }} />
          )}
        </ul>

        {/* The rail's foot. `mt-auto` moved from the pager onto this wrapper — inside
            it the pager's own `mt-auto` resolves to 0 (block flow), so the pair keeps
            sitting on the bottom edge whether or not the pager is there to render.
            Without it a single-page list would leave the hint floating under the last
            row with the rest of the rail empty below it. */}
        <div className="mt-auto shrink-0">
          {/* The component decides: it renders nothing at one page, so an empty result
              (which the API still reports as one page) shows no control either. */}
          <SidebarPagination pageInfo={pageInfo} onPageChange={onPageChange} />

          {/* The standing version of the same offer. Someone whose list is short —
              or who searched and missed — is looking at a list that cannot tell them
              whether the service is missing or their access is; the rail should not
              make them go find that out somewhere else. It is chrome, so it stays up
              during loading, and the full-bleed hairline is what closes the list above
              it (a page of eight rows carries no rule of its own at the bottom).

              It stands under every state, the empty one included — the rail never
              has to decide whether the content column is already saying this. */}
          <div
            className={cn(
              'flex flex-col items-start gap-1 border-t px-3 py-3',
              serviceSidebarStyles.divider,
            )}
          >
            <p className={serviceSidebarStyles.hintText}>담당 시스템/서비스가 조회되지 않나요?</p>
            <RequestAccessLink />
          </div>
        </div>
      </div>
    </aside>
  );
};
