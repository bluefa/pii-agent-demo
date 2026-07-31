'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FilterIcon, SearchIcon } from '@/app/components/ui/icons';
import { cn, numericFeatures } from '@/lib/theme';

export type ApprovalFilter = 'all' | 'target' | 'excluded';

// Step-3 (applying) 연동 상태 filter: Integrated / Pending / 제외, or all (placeholder).
export type IntegrationStatusFilter = 'all' | 'integrated' | 'pending' | 'excluded';

// `waiting` (step 2): [DB Type + Region]. `applying` (step 3): [연동 상태 + DB Type] (v16 6368-6394).
type ToolbarVariant = 'waiting' | 'applying';

interface SelectOption {
  value: string;
  label: string;
}

interface WaitingApprovalToolbarProps {
  variant?: ToolbarVariant;
  searchValue: string;
  onSearchChange: (next: string) => void;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
  dbType: string;
  onDbTypeChange: (next: string) => void;
  region: string;
  onRegionChange: (next: string) => void;
  integrationStatus: string;
  onIntegrationStatusChange: (next: string) => void;
  dbTypeOptions: ReadonlyArray<SelectOption>;
  regionOptions: ReadonlyArray<SelectOption>;
  integrationStatusOptions: ReadonlyArray<SelectOption>;
  countsByFilter: { all: number; target: number; excluded: number };
}

export const WaitingApprovalToolbar = (props: WaitingApprovalToolbarProps) => (
  // .table-toolbar — #F7F8FA surface, radius 12 12 0 0 (attached to table top),
  // 14/16 padding, gap 10, no bottom border (v15 lines 2583–2591).
  <div className="flex flex-wrap items-center gap-[10px] rounded-t-[12px] bg-[#F7F8FA] px-[16px] py-[14px]">
    <SearchBox value={props.searchValue} onChange={props.onSearchChange} />
    {/* waiting (step 2): the stat tiles above ARE this filter, so the segment would duplicate them. */}
    {props.variant !== 'waiting' && (
      <>
        <FilterSeg filter={props.filter} onChange={props.onFilterChange} counts={props.countsByFilter} />
        <Divider />
      </>
    )}
    {/* One filter icon instead of a row of selects — the conditions show only once opened.
        Step 3 (applying) adds the integration-status group, step 2 (waiting) adds Region. */}
    <FilterMenu
      groups={[
        ...(props.variant === 'applying'
          ? [
              {
                key: 'integration',
                label: '연동 상태',
                value: props.integrationStatus,
                onChange: props.onIntegrationStatusChange,
                options: props.integrationStatusOptions,
              },
            ]
          : []),
        {
          key: 'dbType',
          label: 'Database Type',
          value: props.dbType,
          onChange: props.onDbTypeChange,
          options: props.dbTypeOptions,
        },
        ...(props.variant !== 'applying'
          ? [
              {
                key: 'region',
                label: 'Region',
                value: props.region,
                onChange: props.onRegionChange,
                options: props.regionOptions,
              },
            ]
          : []),
      ]}
    />
  </div>
);

interface FilterGroup {
  key: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<SelectOption>;
}

// Filter trigger + popover. The trigger stays tinted while any condition is set, so the state
// survives the popover being closed.
const FilterMenu = ({ groups }: { groups: ReadonlyArray<FilterGroup> }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCount = groups.filter((group) => group.value).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className="relative ml-auto">
      {/* Icon only — no chip, no border. Turns primary blue while a condition is active. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="필터"
        className={cn(
          // 16px glyph, 32x32 hit area (WCAG 2.5.8 asks for at least 24x24).
          // The default 1.4 stroke reads too faint alone (IconProps only accepts className).
          '-mr-2 flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors hover:bg-[#ECEEF1] [&_svg]:stroke-[2.2]',
          activeCount > 0 ? 'text-[#0064FF]' : 'text-[#4E5968] hover:text-[#0064FF]',
        )}
      >
        <FilterIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="group"
          aria-label="필터 옵션"
          className="absolute right-0 top-[26px] z-20 w-[220px] rounded-[10px] border border-[#E5E7EB] bg-white py-1.5 shadow-[0_8px_24px_rgba(17,24,39,0.10)]"
        >
          {/* The list scrolls so the panel height is fixed however many options arrive; group headers stick. */}
          <div className="max-h-[280px] overflow-y-auto">
            {groups.map((group) => (
              <div key={group.key} aria-label={`${group.label} 필터`} role="radiogroup">
                {/* Header sits on a tinted strip with rules above and below: options are a level
                    below it, which same-surface text alone did not convey. */}
                <p className="sticky top-0 z-10 border-y border-[#F1F3F5] bg-[#F9FAFB] px-3 py-[5px] text-[11px] font-bold tracking-[0.02em] text-[#8B95A1] first:border-t-0">
                  {group.label}
                </p>
                <div className="py-1">
                  <FilterOption active={!group.value} onClick={() => group.onChange('')}>
                    전체
                  </FilterOption>
                  {group.options.map((option) => (
                    <FilterOption
                      key={option.value}
                      active={group.value === option.value}
                      onClick={() => group.onChange(option.value)}
                    >
                      {option.label}
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
};

// One option row. Only one value per group can be active, so it renders as a radio: the dot carries
// the state (a check mark reads as "applied" and does not imply the others are mutually exclusive),
// and the extra left indent puts the row visually under its group header.
const FilterOption = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-2 py-[6px] pl-4 pr-3 text-left text-[14px] transition-colors hover:bg-[#F7F8FA]',
      active ? 'font-semibold text-[#191F28]' : 'font-medium text-[#4E5968]',
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors',
        active ? 'border-[#0064FF] border-[4px]' : 'border-[#D1D5DB]',
      )}
    />
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </button>
);

// .tt-divider — 1px × 18px #E5E7EB (v15 lines 2616–2618).
const Divider = () => <span className="h-[18px] w-px bg-[#E5E7EB]" aria-hidden="true" />;

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
}

// .tt-search — relative wrapper, flex 1 1 260px, min 220 / max 360 (v15 lines 2592–2611).
const SearchBox = ({ value, onChange }: SearchBoxProps) => (
  <div className="relative min-w-[220px] max-w-[360px] flex-[1_1_260px]">
    {/* icon — absolute left 10, #9CA3AF, no pointer events. */}
    <SearchIcon
      className="pointer-events-none absolute left-[10px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]"
      aria-hidden="true"
    />
    {/* input — h32, 1px #E5E7EB, radius 8, white bg, focus ring #0064FF + 3px halo. */}
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Resource ID 또는 DB Name 검색"
      className="h-8 w-full rounded-[8px] border border-[#E5E7EB] bg-white pl-[32px] pr-[12px] text-[14px] text-[#111827] outline-none focus:border-[#0064FF] focus:shadow-[0_0_0_3px_rgba(0,100,255,0.08)]"
      aria-label="리소스 검색"
    />
  </div>
);

interface FilterSegProps {
  filter: ApprovalFilter;
  onChange: (next: ApprovalFilter) => void;
  counts: { all: number; target: number; excluded: number };
}

const FILTER_BUTTONS: ReadonlyArray<{ value: ApprovalFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'target', label: '연동 대상' },
  { value: 'excluded', label: '연동 제외대상' },
];

// .filter-seg — white bg, border 0, radius 10, padding 3px (v15 lines 2623–2630).
const FilterSeg = ({ filter, onChange, counts }: FilterSegProps) => (
  <div className="inline-flex items-center rounded-[10px] bg-white p-[3px]" role="group" aria-label="대상 필터">
    {FILTER_BUTTONS.map((btn) => {
      const active = filter === btn.value;
      return (
        <button
          key={btn.value}
          type="button"
          onClick={() => onChange(btn.value)}
          aria-pressed={active}
          // .filter-seg button — h30, 13/600, padding 0 14, radius 8, #8B95A1;
          // .active — bg #191F28 (near-black, NOT blue), #fff, 700.
          className={cn(
            'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[14px] text-[14px] transition-colors',
            active
              ? 'bg-[#191F28] font-bold text-white'
              : 'font-semibold text-[#8B95A1] hover:text-[#191F28]',
          )}
        >
          {btn.label}
          {/* .cnt — pill bg #F7F8FA / 1px 7px / radius 999 / 11.5px / 700;
              .active .cnt — bg rgba(255,255,255,0.20) / #fff. */}
          <span
            className={cn(
              'rounded-[999px] px-[7px] py-px text-[12px] font-bold',
              numericFeatures.tabular,
              active ? 'bg-white/20 text-white' : 'bg-[#F7F8FA] text-[#8B95A1]',
            )}
          >
            {counts[btn.value]}
          </span>
        </button>
      );
    })}
  </div>
);
