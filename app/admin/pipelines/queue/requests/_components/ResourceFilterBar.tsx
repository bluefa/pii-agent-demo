'use client';

/**
 * P3 resource-list filter — step 2's list grammar on the admin pipeline tokens. The
 * admin and the service owner look at the same request, so the two screens should not
 * operate their lists differently.
 *
 * Grammar, not components: step 2's WaitingApprovalStats / WaitingApprovalToolbar
 * hard-code the app palette (#0064FF), which would drop app blue into a --pl-*
 * console. Same layout and metrics (40px count, h32 search, 12/12/0/0 toolbar).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { FilterIcon } from '@/app/components/ui/icons';
import type { ResourceCounts, ResourceFilter } from '@/app/admin/pipelines/queue/requests/_resourceQuery';

export interface ResourceStatTilesProps {
  counts: ResourceCounts;
  filter: ResourceFilter;
  onFilterChange: (next: ResourceFilter) => void;
}

/** The three counts ARE the 전체/대상/제외 filter — not a read-only summary above one. */
export function ResourceStatTiles({ counts, filter, onFilterChange }: ResourceStatTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-3" role="group" aria-label="대상 필터">
      <StatTile label="전체 요청" value={counts.all} active={filter === 'all'} onClick={() => onFilterChange('all')} />
      <StatTile label="연동 요청 대상" value={counts.target} active={filter === 'target'} onClick={() => onFilterChange('target')} />
      <StatTile label="연동 요청 제외대상" value={counts.excluded} active={filter === 'excluded'} onClick={() => onFilterChange('excluded')} />
    </div>
  );
}

/**
 * 한 줄짜리 필터 타일 — 라벨 왼쪽, 수 오른쪽.
 *
 * 전에는 세로 2단에 40px 숫자라 한 장이 112px 이었다(오너 지시 2026-08-15: 작게).
 * 그 크기는 이 블록이 전폭 페이지의 첫 화면을 여는 요약이던 때의 것이고, 지금은 승인
 * 시트 안에서 표 바로 위에 놓인 **필터**다 — 세 수가 표보다 크게 읽힐 이유가 없다.
 * 44px 한 줄이라도 313px 폭의 누를 자리는 그대로다.
 *
 * 수는 20px, 라벨은 14px — 한 줄 안에서 수가 여전히 이기되 표의 14px 값과 싸우지 않는
 * 단이다.
 */
function StatTile({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border px-4 py-2.5 text-left transition-colors duration-150',
        'bg-[var(--pl-bg-card)] shadow-[var(--pl-shadow-xs)]',
        // Selection speaks only through the boundary — a brand stroke doubled by an
        // inset ring, so the tile never shifts or changes surface when picked.
        active
          ? 'border-[var(--pl-primary)] ring-1 ring-inset ring-[var(--pl-primary)]'
          : 'border-[var(--pl-border)] hover:border-[var(--pl-primary)]',
      )}
    >
      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--pl-text-weak)]">
        {label}
      </span>
      <span className="flex flex-none items-baseline">
        <span className="text-[20px] font-bold leading-[1.2] tabular-nums text-[var(--pl-text-strong)]">
          {value}
        </span>
        <span className="ml-0.5 text-[12px] font-medium text-[var(--pl-text-weak)]">건</span>
      </span>
    </button>
  );
}

export interface FilterGroup {
  key: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  /** Option label override (구분 IP/HOST → IP/Host); defaults to the raw value. */
  formatOption?: (value: string) => string;
}

export interface ResourceToolbarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder: string;
  groups: readonly FilterGroup[];
  /** Section-level action rendered before the filter trigger (IDC: NLB 리스너 현황). */
  actions?: ReactNode;
}

/**
 * Attaches to the table top (radius 12/12/0/0) — toolbar + table + bordered pager
 * footer are one card, as in step 1.
 *
 * It draws its own top and side borders because the section no longer sits inside a
 * Card. The band was --pl-gray-50 (#F9FAFB), byte-identical to --pl-bg-page, so with
 * the card gone the whole header was invisible against the page; gray-100 (#F2F4F7)
 * separates them, and the border is what actually carries the edge — this palette's
 * page and surface tiers are 1.05:1 apart, so luminance alone can never bound a
 * surface here.
 */
export function ResourceToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  groups,
  actions,
}: ResourceToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-[10px] rounded-t-[12px] border border-b-0 border-[var(--pl-border)] bg-[var(--pl-gray-100)] px-4 py-[14px]">
      <SearchBox
        wrapClassName="min-w-[220px] max-w-[360px] flex-[1_1_260px]"
        aria-label="리소스 검색"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <span className="ml-auto flex items-center gap-2">
        {actions}
        <FilterMenu groups={groups} />
      </span>
    </div>
  );
}

/** Filter trigger + popover. The trigger stays tinted while any condition is set, so
 *  the state survives the popover being closed.
 *
 *  Exported so other admin lists wear the same trigger + card rather than a row of
 *  always-open selects. This is the --pl-* twin of step 1's filter menu
 *  (`WaitingApprovalToolbar`), which cannot be reused here because it hard-codes
 *  the app palette — see this file's header. */
export function FilterMenu({ groups: allGroups }: { groups: readonly FilterGroup[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // A group with one value is not a choice — dropped, unless its value IS set (else
  // a refetch that drops the selected option would leave no control to clear it).
  const groups = allGroups.filter((group) => group.options.length > 1 || group.value);
  const activeCount = groups.filter((group) => group.value).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      // `instanceof` rather than a cast: EventTarget is not always a Node
      // (media elements, XHR), and an assertion would hide that.
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (groups.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="필터"
        className={cn(
          // 32x32 hit area (WCAG 2.5.8 asks for at least 24x24) around a 16px glyph.
          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--pl-gray-100)] [&_svg]:stroke-[2.2]',
          activeCount > 0
            ? 'text-[var(--pl-primary)]'
            : 'text-[var(--pl-text-medium)] hover:text-[var(--pl-primary)]',
        )}
      >
        <FilterIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="group"
          aria-label="필터 옵션"
          className="absolute right-0 top-[34px] z-20 w-[220px] rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-card)] py-1.5 shadow-[var(--pl-shadow-lg)]"
        >
          {/* The list scrolls so the panel height is fixed however many options arrive. */}
          <div className="max-h-[280px] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.key} aria-label={`${group.label} 필터`} role="radiogroup">
                <p className="sticky top-0 z-10 border-y border-[var(--pl-gray-100)] bg-[var(--pl-gray-50)] px-3 py-[5px] text-[11px] font-bold tracking-[0.02em] text-[var(--pl-text-weak)] first:border-t-0">
                  {group.label}
                </p>
                <div className="py-1">
                  <FilterOption active={!group.value} onClick={() => group.onChange('')}>
                    전체
                  </FilterOption>
                  {group.options.map((option) => (
                    <FilterOption
                      key={option}
                      active={group.value === option}
                      onClick={() => group.onChange(option)}
                    >
                      {group.formatOption ? group.formatOption(option) : option}
                    </FilterOption>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One value per group, so the row is a radio: the dot carries the state (a check
 *  mark reads as "applied" and would not imply the options are exclusive). */
function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 py-[6px] pl-4 pr-3 text-left text-[14px] transition-colors hover:bg-[var(--pl-gray-50)]',
        active
          ? 'font-semibold text-[var(--pl-text-strong)]'
          : 'font-medium text-[var(--pl-text-medium)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors',
          active ? 'border-[4px] border-[var(--pl-primary)]' : 'border-[var(--pl-border-strong)]',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
