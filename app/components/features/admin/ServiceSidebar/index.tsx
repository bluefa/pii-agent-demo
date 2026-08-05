'use client';

import { ServiceRow } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { CloseIcon, SearchIcon } from '@/app/components/ui/icons';
import type { PageServiceItem } from '@/app/lib/api';
import {
  borderColors,
  bgColors,
  idcStyles,
  primaryColors,
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

/** Skeleton row count — matches SERVICE_PAGE_SIZE so the list doesn't reflow when data lands. */
const SKELETON_ROWS = 8;

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

  // Rows the ul will actually lay out — drives the height cap below.
  const rowCount = loading ? SKELETON_ROWS : listed.length;

  // One label per list mode, so the list always says what its rows are.
  const sectionLabel = searchQuery ? '검색 결과' : '전체 서비스';

  return (
    // v16 `.sidebar` — fixed 296px width (measured), shrink-0 so the main column owns the rest.
    //
    // Desktop rail grammar: one flush white plane, zones divided by full-bleed
    // hairlines. The rail owns no padding — each zone sets its own, so the
    // current-service band and the row hover fills can run edge to edge.
    <aside
      className={cn(
        'w-[296px] shrink-0 flex flex-col border-r',
        serviceSidebarStyles.surface,
        borderColors.default,
      )}
      aria-label="서비스 목록"
    >
      {/* Title + total. The pill is the rail's only count — during a search it is
          the hit count, which is why it is no longer hidden then. */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-2.5">
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
        {(loading || listed.length > 0) && (
          <div className={cn('px-3 pt-3 pb-1.5 shrink-0', serviceSidebarStyles.sectionLabel)}>
            {sectionLabel}
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
                <div className={cn(idcStyles.skeletonBar, 'h-7 w-7 shrink-0 rounded-[6px]')} />
                <div className={cn(idcStyles.skeletonBar, 'h-3 flex-1 rounded')} />
                <div className={cn(idcStyles.skeletonBar, 'h-5 w-10 shrink-0 rounded-[6px]')} />
              </li>
            ))
          ) : listed.length === 0 ? (
            // Keyed off `listed`, not `services` — a page holding nothing but the current
            // service filters down to empty. Each reason gets its own sentence: only quote
            // a search term when there is one, only say "other services" when there is a
            // current service to be other than, and keep that sentence page-scoped, since
            // the filter is.
            <li className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <p className={cn('text-sm', textColors.tertiary)}>
                {searchQuery
                  ? `‘${searchQuery}’와 일치하는 서비스가 없습니다`
                  : '서비스가 없습니다'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className={cn(
                    'mt-2 text-xs cursor-pointer',
                    primaryColors.text,
                    primaryColors.textHover,
                  )}
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
        </ul>

        {/* The component decides: it renders nothing at one page, so an empty result
            (which the API still reports as one page) shows no control either. */}
        <SidebarPagination pageInfo={pageInfo} onPageChange={onPageChange} />
      </div>
    </aside>
  );
};
