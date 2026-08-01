'use client';

import { ChevronRightIcon, CloseIcon, SearchIcon } from '@/app/components/ui/icons';
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
// Service names run up to 30 characters — wrap to a second line instead of cutting
// them off at the panel's 296px. The full name stays in the row's title attribute.
const nameClass = 'flex-1 min-w-0 text-sm font-normal line-clamp-2 break-words';
const codeClass = 'ml-1.5 font-mono text-xs';

// Several services are named after their own code (AWS/aws, GCP/gcp, SDU/SDU), where
// trailing the code reads as a stutter and adds nothing. Anything the name already
// spells out is dropped.
const showsCode = (code: string, name?: string) =>
  Boolean(name) && name?.toLowerCase() !== code.toLowerCase();

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
 * Name first, then the code trailing it as plain monospace text.
 *
 * The code used to lead the row inside a grey chip. Two things were wrong with that:
 * a chip is the visual language of mutable, categorical state (status, owner), and a
 * per-row-unique identifier is neither — the container carried no grouping information
 * at full visual weight. And it put the least information-carrying token at the left
 * edge, where users scan; every row began with the same grey rectangle, so the names
 * (the actual scan target) all started one indent in.
 *
 * The code stays inline rather than in its own column so it flows with the name and
 * wraps with it; it is still exact and case-sensitive (`/services/{code}` matches
 * exactly), just no longer competing with the name for first read.
 */
const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn('group', rowLayoutClass, bgColors.mutedHover)}
    >
      <span className={nameClass}>
        <span className={textColors.primary}>{name || code}</span>
        {showsCode(code, name) && (
          <span className={cn(codeClass, textColors.quaternary)}>{code}</span>
        )}
      </span>
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
 * group. The caption says what it is, so no badge is needed; below it the same
 * [name][code] grammar as the list rows. The tinted card is already a container, so a
 * chip around the code here would be a container inside a container.
 * It is a destination like any other row, so it stays clickable.
 */
const CurrentServiceCard = ({ code, name, onSelect }: ServiceRowProps) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn(
      'mt-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors',
      primaryColors.bgLight,
    )}
  >
    <span className={cn('block text-xs font-semibold', primaryColors.textOnLight)}>
      현재 보고 있는 서비스
    </span>
    <span className={cn('mt-1.5 block text-sm line-clamp-2 break-words', primaryColors.textOnLight)}>
      {name || code}
      {showsCode(code, name) && <span className={cn(codeClass, 'opacity-60')}>{code}</span>}
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
      <div className={cn('px-3 py-3 border-t', borderColors.light)}>
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
              '!py-2 !pl-9 !pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none',
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="검색어 지우기"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors',
                textColors.quaternary,
                bgColors.mutedHover,
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

      <ul className="flex-1 overflow-auto px-2 pb-2" aria-busy={loading}>
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            // h-9 matches a real single-line row (20px text + py-2) so the list
            // doesn't jump height when the skeleton is replaced.
            <li key={i} className="flex h-9 items-center px-3" aria-hidden="true">
              <div className={cn(idcStyles.skeletonBar, 'h-3.5 w-2/3 rounded')} />
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
