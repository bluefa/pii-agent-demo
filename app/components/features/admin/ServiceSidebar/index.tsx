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

  // The current service lives in the header, so browsing the list would show it twice.
  // A search is different: the results are the results, and hiding a match would lie.
  const listed = !searchQuery && currentService
    ? services.filter((s) => s.service_code !== currentService.code)
    : services;

  // One label per list mode, so the card always says what its rows are.
  const sectionLabel = searchQuery
    ? '검색 결과'
    : currentService
      ? '다른 서비스로 이동'
      : '전체 서비스';

  return (
    // v16 `.sidebar` — fixed 296px width (measured), shrink-0 so the main column owns the rest.
    //
    // Toss grouping grammar: the rail sits on the page canvas (#F4F4FB) and the
    // white cards — current service, list — do the separating. No hairline zones
    // inside the rail; the surfaces are the group boundaries.
    <aside
      className={cn(
        'w-[296px] shrink-0 flex flex-col gap-3 border-r px-3 pt-4 pb-3',
        serviceSidebarStyles.ground,
        borderColors.default,
      )}
      aria-label="서비스 목록"
    >
      {/* Title + total. The count renders only outside a search: during one,
          totalElements is the hit count and the line under the input owns it. */}
      <div className="flex items-baseline gap-2 px-1">
        <h2 className={serviceSidebarStyles.title}>서비스 목록</h2>
        {!searchQuery && !loading && totalElements > 0 && (
          <span className={serviceSidebarStyles.count}>{totalElements}</span>
        )}
      </div>

      {currentService && (
        <CurrentServiceCard
          code={currentService.code}
          name={currentService.name}
          onSelect={onSelectService}
        />
      )}

      {/* The relative box is the input itself, so the icons center on it — no
          offset math against the wrapper's padding. */}
      <div>
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
              // Explicit white: on the canvas ground a field has to be the lifted surface.
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
        {searchQuery && (
          <p className={cn('mt-2 px-1 text-xs tabular-nums', textColors.tertiary)}>
            {totalElements}건
          </p>
        )}
      </div>

      {/* List card. It hugs its rows instead of stretching to the rail's bottom —
          a page of 8 with a stretched card rebuilt the dead-space-over-footer the
          redesign removed. No flex-1: the card only shrinks (min-h-0 + default
          flex-shrink) when the viewport is too short, and the ul scrolls then. */}
      <div className={cn('min-h-0 flex flex-col', serviceSidebarStyles.card)}>
        {(loading || listed.length > 0) && (
          <div className={cn('px-3 pt-3 pb-1 shrink-0', serviceSidebarStyles.sectionLabel)}>
            {sectionLabel}
          </div>
        )}

        <ul className="min-h-0 overflow-auto px-1.5 pb-1.5" aria-busy={loading}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              // h-10 matches a real row (24px tile + py-2) so the list doesn't
              // jump height when the skeleton is replaced.
              <li key={i} className="flex h-10 items-center gap-2.5 px-2.5" aria-hidden="true">
                <div className={cn(idcStyles.skeletonBar, 'h-6 w-6 shrink-0 rounded-[7px]')} />
                <div className={cn(idcStyles.skeletonBar, 'h-3.5 flex-1 rounded')} />
                <div className={cn(idcStyles.skeletonBar, 'h-4 w-10 shrink-0 rounded-[6px]')} />
              </li>
            ))
          ) : listed.length === 0 ? (
            // Keyed off `listed`, not `services` — a page holding nothing but the current
            // service filters down to empty. Each reason gets its own sentence: only quote
            // a search term when there is one, only say "other services" when there is a
            // current service to be other than, and keep that sentence page-scoped, since
            // the filter is.
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

        {/* Gated on `totalElements`, not `totalPages` — the API reports one page for an
            empty result, so `totalPages` alone can't tell "one page of hits" from
            "nothing to page through". */}
        {totalElements > 0 && (
          <SidebarPagination pageInfo={pageInfo} onPageChange={onPageChange} />
        )}
      </div>
    </aside>
  );
};
