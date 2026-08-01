'use client';

import { CurrentServiceCard } from '@/app/components/features/admin/ServiceSidebar/CurrentServiceCard';
import { ServiceRow } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { SidebarPagination } from '@/app/components/features/admin/ServiceSidebar/SidebarPagination';
import { CloseIcon, SearchIcon } from '@/app/components/ui/icons';
import type { PageServiceItem } from '@/app/lib/api';
import {
  borderColors,
  bgColors,
  idcStyles,
  primaryColors,
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

/** The service the surrounding page is about — pinned above the list and highlighted. */
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

// Rows sit at ul(px-2) + button(px-3); the column header matches that 20px inset on
// both edges so its labels line up with the name and the code column.
const listInsetClass = 'px-5';

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
  const { totalElements, totalPages, number: currentPage } = pageInfo;

  // The current service lives in the header, so browsing the list would show it twice.
  // A search is different: the results are the results, and hiding a match would lie.
  const listed = !searchQuery && currentService
    ? services.filter((s) => s.service_code !== currentService.code)
    : services;

  return (
    // v16 `.sidebar` — fixed 296px width (measured), shrink-0 so the main column owns the rest.
    //
    // Recessed, not elevated: the right-hand rail — the same kind of thing — sits on the
    // canvas tint with white cards on top, so nav chrome does not get to float above it.
    // A hairline does the separating.
    //
    // gray-50 rather than the page's own tint: the target-source canvas is #F4F4FB, and
    // gray-500 measures 4.41:1 on it — under AA. On gray-50 the same text holds 4.63:1,
    // and the two grounds are within 1% of each other, so it still reads as one plane.
    <aside
      className={cn(
        'w-[296px] shrink-0 flex flex-col border-r',
        bgColors.muted,
        borderColors.default,
      )}
    >
      {/* Header zone: what this panel is, and where you currently are. */}
      <div className="px-3 pt-4 pb-4">
        {/* 18/700 against the card name's 14/600 — two levers apart, so the two never
            read as peers. px-2 inside the zone's px-3 puts the title on the same 20px
            left edge as the column header and the rows, so every text in the panel
            starts on one axis. */}
        <h2 className={cn('px-2 text-lg font-bold', textColors.primary)}>서비스 목록</h2>
        {currentService && (
          <CurrentServiceCard
            code={currentService.code}
            name={currentService.name}
            onSelect={onSelectService}
          />
        )}
      </div>

      {/* List zone: search is the list's control, so it sits with the list, not under the title. */}
      {/* gray-200 dividers, not gray-100: on the gray-50 ground gray-100 is a 1.5%
          step and effectively disappears. */}
      <div className={cn('px-3 py-3 border-t', borderColors.default)}>
        {/* The relative box is the input itself, so the icons center on it — no
            offset math against the wrapper's padding. */}
        <div className="relative">
          <SearchIcon
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2',
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
              // Explicit white: on the recessed panel a field has to be the lifted surface.
              '!py-2 !pl-9 !pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none',
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
                textColors.quaternary,
                bgColors.surfaceHover,
              )}
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className={cn('mt-2 px-1 text-xs tabular-nums', textColors.tertiary)}>
            {totalElements}건
          </p>
        )}
      </div>

      {/* Column header. A right-aligned mono token is unreadable without a label, so
          pushing the code into its own column requires naming the columns. 12px tertiary
          — table chrome, a clear tier below the panel title. Not quaternary: gray-400 is
          2.5:1 on white, and a label nobody can read defeats the column it names. Keyed
          off `listed`, the rows actually rendered, so headings never sit over an empty
          body. */}
      {(loading || listed.length > 0) && (
        <div
          className={cn(
            'flex items-baseline justify-between pb-1.5 border-b',
            listInsetClass,
            borderColors.default,
          )}
        >
          {/* medium + tracking, against the code column's 12/400/gray-500. Identical
              specs made the heading read as the column's first entry instead of its
              label; 12px is the scale floor, so weight and tracking do the separating. */}
          <span className={cn('text-xs font-medium tracking-wide', textColors.tertiary)}>
            서비스 이름
          </span>
          <span className={cn('text-xs font-medium tracking-wide', textColors.tertiary)}>
            서비스 코드
          </span>
        </div>
      )}

      <ul className="flex-1 overflow-auto px-2 py-2" aria-busy={loading}>
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            // h-9 matches a real single-line row (20px text + py-2) so the list
            // doesn't jump height when the skeleton is replaced.
            <li key={i} className="flex h-9 items-center justify-between px-3" aria-hidden="true">
              <div className={cn(idcStyles.skeletonBar, 'h-3.5 w-2/3 rounded')} />
              <div className={cn(idcStyles.skeletonBar, 'h-3 w-8 rounded')} />
            </li>
          ))
        ) : listed.length === 0 ? (
          // Keyed off `listed`, not `services`: a page holding nothing but the current
          // service filters down to an empty list, and reporting the unfiltered count
          // left the body blank with no explanation. Each empty reason gets its own
          // sentence — quoting an empty search term reads as a rendering bug, and the
          // "other services" wording is untrue when there is no current service to be
          // other than. The filter is page-scoped, so the sentence is too: earlier
          // pages may well hold services this one does not.
          <li className="px-4 py-10 text-center">
            <p className={cn('text-sm', textColors.tertiary)}>
              {searchQuery
                ? `‘${searchQuery}’와 일치하는 서비스가 없습니다`
                : currentService
                  ? '이 페이지에 다른 서비스가 없습니다'
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
              />
            );
          })
        )}
      </ul>

      {/* Shown from the first page on so the control doesn't appear and disappear as the
          result count crosses one page. `totalElements` gates it, not `totalPages`: an
          empty result still reports one page, which rendered a lone clickable "1" under
          "no services". */}
      {totalElements > 0 && totalPages > 0 && (
        <SidebarPagination
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      )}
    </aside>
  );
};
