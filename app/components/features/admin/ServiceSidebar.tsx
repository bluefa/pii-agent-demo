'use client';

import { ChevronRightIcon, SearchIcon } from '@/app/components/ui/icons';
import type { PageServiceItem } from '@/app/lib/api';
import {
  borderColors,
  bgColors,
  idcStyles,
  primaryColors,
  tagStyles,
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

const rowLayoutClass = 'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors';
const chipClass = 'shrink-0 w-14 py-1 rounded-md text-center font-mono text-xs font-normal truncate';
const nameClass = 'flex-1 min-w-0 truncate text-sm font-normal';

const pageButtonClass = cn(
  'w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
  bgColors.mutedHover,
  textColors.tertiary,
);

interface ServiceRowProps {
  code: string;
  name?: string;
  onSelect: (code: string) => void;
}

/**
 * Code chip + name. The chip is a fixed-width column so the names line up and the
 * list can be scanned down a single edge; it carries the full code (case-sensitive —
 * `/services/{code}` matches exactly), so no duplicate code sub-line is needed.
 */
const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn('group', rowLayoutClass, bgColors.mutedHover)}
    >
      <span className={cn(chipClass, tagStyles.neutral)}>{code}</span>
      <span className={cn(nameClass, textColors.primary)}>{name || code}</span>
      <ChevronRightIcon
        className={cn(
          'shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
          textColors.quaternary,
        )}
      />
    </button>
  </li>
);

/**
 * The service the page is about, shown in the header zone as context — not as a list
 * group. It is a destination like any other row, so it stays clickable.
 */
const CurrentServiceCard = ({ code, name, onSelect }: Omit<ServiceRowProps, 'isCurrent'>) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn('mt-3', rowLayoutClass, primaryColors.bgLight)}
  >
    <span className={cn(chipClass, bgColors.surface, primaryColors.textOnLight)}>{code}</span>
    <span className={cn(nameClass, primaryColors.textOnLight)}>{name || code}</span>
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-xs',
        bgColors.surface,
        primaryColors.textOnLight,
      )}
    >
      현재
    </span>
  </button>
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
  const { totalElements, totalPages, number: currentPage } = pageInfo;

  const paginationStart = Math.max(0, currentPage - 2);
  const paginationEnd = Math.min(totalPages, paginationStart + 5);
  const pageNumbers = Array.from({ length: paginationEnd - paginationStart }, (_, i) => paginationStart + i);

  // The current service lives in the header, so browsing the list would show it twice.
  // A search is different: the results are the results, and hiding a match would lie.
  const listed = !searchQuery && currentService
    ? services.filter((s) => s.service_code !== currentService.code)
    : services;

  return (
    // v16 `.sidebar` — fixed 296px width (measured), shrink-0 so the main column owns the rest.
    <aside className="w-[296px] shrink-0 bg-white shadow-sm flex flex-col">
      {/* Header zone: what this panel is, and where you currently are. */}
      <div className="px-3 pt-4 pb-4">
        <h2 className={cn('px-1 text-base font-semibold', textColors.primary)}>서비스 목록</h2>
        {currentService && (
          <CurrentServiceCard
            code={currentService.code}
            name={currentService.name}
            onSelect={onSelectService}
          />
        )}
      </div>

      {/* List zone: search is the list's control, so it sits with the list, not under the title. */}
      <div className={cn('px-3 pt-3 pb-3 relative border-t', borderColors.light)}>
        <SearchIcon
          className={cn('absolute left-6 top-1/2 -translate-y-[calc(50%+6px)]', textColors.quaternary)}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="서비스 이름 또는 코드"
          aria-label="서비스 검색"
          className={cn(getInputClass(), '!py-2 !pl-9 !pr-14 text-sm')}
        />
        {searchQuery && (
          <span
            className={cn(
              'absolute right-6 top-1/2 -translate-y-[calc(50%+6px)] text-xs tabular-nums',
              textColors.tertiary,
            )}
          >
            {totalElements}건
          </span>
        )}
      </div>

      <ul className="flex-1 overflow-auto px-2 pb-2" aria-busy={loading}>
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className="flex items-center gap-2.5 px-3 py-2" aria-hidden="true">
              <div className={cn(idcStyles.skeletonBar, 'h-[26px] w-14 rounded-md shrink-0')} />
              <div className={cn(idcStyles.skeletonBar, 'h-3.5 flex-1 rounded')} />
            </li>
          ))
        ) : services.length === 0 ? (
          <li className="px-4 py-10 text-center">
            <p className={cn('text-sm', textColors.tertiary)}>
              ‘{searchQuery}’와 일치하는 서비스가 없습니다
            </p>
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className={cn('mt-2 text-xs', primaryColors.text, primaryColors.textHover)}
            >
              검색어 지우기
            </button>
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

      {/* Pagination only — the hit count sits next to the input. Shown from the first
          page on so the control doesn't appear and disappear as the result count
          crosses one page; hidden only when there is nothing to page through. */}
      {totalPages > 0 && (
        <div className={cn('border-t px-4 py-3', borderColors.light)}>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className={pageButtonClass}
              aria-label="이전 페이지"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPageChange(n)}
                className={cn(
                  'w-7 h-7 text-xs rounded-md transition-colors flex items-center justify-center',
                  // Current page reads as "pressed" (neutral fill), not as an accent —
                  // paging is navigation, not a branded action.
                  n === currentPage
                    ? cn(tagStyles.neutral, 'font-semibold')
                    : cn(textColors.tertiary, bgColors.mutedHover),
                )}
              >
                {n + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className={pageButtonClass}
              aria-label="다음 페이지"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
