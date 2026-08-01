'use client';

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

// Tailwind v4 preflight gives buttons `cursor: default`, so clickable rows have to ask
// for the pointer explicitly — same as Pagination and Table do.
const rowLayoutClass =
  'w-full flex items-start gap-3 rounded-lg px-3 py-2 text-left cursor-pointer transition-colors';
// Service names run up to 30 characters — wrap to a second line instead of cutting
// them off at the panel's 296px. The full name stays in the row's title attribute.
const nameClass = 'flex-1 min-w-0 text-sm font-normal line-clamp-2 break-words';
// leading-5 matches the name's line box so the code sits on the first line's baseline
// even when the name wraps — the code column keeps one horizontal rhythm down the list.
const codeClass = 'shrink-0 font-mono text-xs leading-5 text-right';
// Rows sit at ul(px-2) + button(px-3); the column header matches that 20px inset on
// both edges so its labels line up with the name and the code column.
const listInsetClass = 'px-5';

const pageButtonClass = cn(
  'w-7 h-7 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
  bgColors.surfaceHover,
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
 * The code gets its own right-hand column rather than trailing the name inline:
 * names vary in length, so an inline code landed at a different x on every row and
 * never became scannable. Pushed right it stacks into a column you can read straight
 * down — which is what the header above the list labels. It stays exact and
 * case-sensitive (`/services/{code}` matches exactly).
 *
 * The hover chevron is gone: the code owns the right edge now, and the row's hover
 * fill already reads as clickable.
 */
const ServiceRow = ({ code, name, onSelect }: ServiceRowProps) => (
  <li>
    <button
      type="button"
      onClick={() => onSelect(code)}
      title={name ? `${name} (${code})` : code}
      className={cn('group', rowLayoutClass, primaryColors.bgLightActive)}
    >
      <span className={cn(nameClass, textColors.primary, primaryColors.groupTextOnLight)}>
        {name || code}
      </span>
      {name && (
        // tertiary, not quaternary: gray-400 sits at 2.5:1 on white, under AA for 12px.
        <span className={cn(codeClass, textColors.tertiary, primaryColors.groupTextOnLight)}>
          {code}
        </span>
      )}
    </button>
  </li>
);

/**
 * The service the page is about, shown in the header zone as context — not as a list
 * group. The caption says what it is, so no badge is needed.
 *
 * Plain text, no container. This began as a tinted card because it inherited the weight
 * of the "현재 서비스" list group it replaced, and a filled block reads as something to
 * act on — but this only answers "where am I", which nobody needs drawn to. The sidebar
 * references land in the same place: Notion and Linear put the current workspace at the
 * top as plain text, and Primer marks a selection with a small glyph on the item rather
 * than a block around it.
 *
 * Only the name, one weight step above the rows. The code is the key you need when
 * *choosing* a row, so repeating it here re-ran the list's grammar in the one place with
 * no column to line up with. It stays in the title attribute for the exact value.
 *
 * It is a destination like any other row, so it stays clickable.
 */
const CurrentServiceCard = ({ code, name, onSelect }: ServiceRowProps) => (
  <button
    type="button"
    onClick={() => onSelect(code)}
    title={name ? `${name} (${code})` : code}
    className={cn(
      // No fill, no border, no card. Nothing at rest but text at the panel's 20px
      // left edge; the neutral hover is the only chrome, and only while pointed at.
      'mt-3 w-full rounded-lg px-2 py-1.5 text-left cursor-pointer transition-colors',
      bgColors.surfaceHover,
    )}
  >
    {/* Caption lighter than the value it labels — 12px/500 against 14px/600, so size
        and weight point the same way instead of fighting. gray-500 only became
        available when the tint went away: it measures 4.3:1 on #E8F1FF but 4.9:1 on
        white. */}
    <span className={cn('block text-xs font-medium', textColors.tertiary)}>
      현재 보고 있는 서비스
    </span>
    <span
      className={cn(
        'mt-1.5 block text-sm font-semibold line-clamp-2 break-words',
        textColors.primary,
      )}
    >
      {name || code}
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
    //
    // Recessed, not elevated. White + shadow-sm made this the only surface in the shell
    // claiming to float above the canvas, while the right-hand rail — the same kind of
    // thing — sits on the canvas tint with white cards on top. Nav chrome outranking
    // content is backwards, so the panel joins the canvas plane and a hairline does the
    // separating.
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
        {/* 18/700 against the card name's 14/600: two levers apart. At 16/600 the two
            differed only by 2px and read as peers — the exact collision the tinted card
            was introduced to avoid. */}
        {/* px-2 inside the zone's px-3 puts the title on the same 20px left edge as the
            column header and the rows. Without the card's fill to mark its own bounds,
            every text in the panel now starts on one axis. */}
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
              // Explicit white: the input was transparent and borrowed the panel's old
              // white ground. On the recessed panel a field has to be the lifted surface.
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
          pushing the code into its own column requires naming the columns. Kept at
          12px tertiary — table chrome, a clear tier below the 16px panel title, so it
          doesn't read as a third heading competing with it. Not quaternary: gray-400
          is 2.5:1 on white, and a label nobody can read defeats the column it names.
          Keyed off `listed`, the rows actually rendered, so headings never sit over an
          empty body. */}
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
          // sentence — quoting an empty search term reads as a rendering bug, and
          // "다른 서비스가 없습니다" is untrue when there is no current service to be
          // other than.
          <li className="px-4 py-10 text-center">
            <p className={cn('text-sm', textColors.tertiary)}>
              {searchQuery
                ? `‘${searchQuery}’와 일치하는 서비스가 없습니다`
                : currentService
                  ? '다른 서비스가 없습니다'
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

      {/* Pagination only — the hit count sits next to the input. Shown from the first
          page on so the control doesn't appear and disappear as the result count
          crosses one page; hidden only when there is nothing to page through. */}
      {totalPages > 0 && (
        <div className={cn('border-t px-4 py-3', borderColors.default)}>
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
                  'w-7 h-7 text-xs rounded-md cursor-pointer transition-colors flex items-center justify-center',
                  // Current page reads as "pressed", not as an accent — paging is
                  // navigation, not a branded action. The old gray-100 chip vanished
                  // once the panel itself went gray-50 (1.05:1 against the ground), so
                  // the marker is now a lifted white key with an edge: white matches the
                  // panel's other raised surfaces (the search field, row hover) and the
                  // border is what actually carries the shape.
                  n === currentPage
                    ? cn(
                        'border font-semibold',
                        bgColors.surface,
                        borderColors.emphasis,
                        textColors.secondary,
                      )
                    : cn(textColors.tertiary, bgColors.surfaceHover),
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
