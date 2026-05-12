'use client';

import { SearchIcon } from '@/app/components/ui/icons';
import {
  borderColors,
  cn,
  interactiveColors,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

export type ApprovalFilter = 'all' | 'target' | 'excluded';

interface SelectOption {
  value: string;
  label: string;
}

interface WaitingApprovalToolbarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
  dbType: string;
  onDbTypeChange: (next: string) => void;
  region: string;
  onRegionChange: (next: string) => void;
  dbTypeOptions: ReadonlyArray<SelectOption>;
  regionOptions: ReadonlyArray<SelectOption>;
  countsByFilter: { all: number; target: number; excluded: number };
  visibleStart: number;
  visibleEnd: number;
  totalCount: number;
}

export const WaitingApprovalToolbar = (props: WaitingApprovalToolbarProps) => (
  <div className={cn('flex flex-wrap items-center gap-3 py-3 border-b', borderColors.light)}>
    <SearchBox value={props.searchValue} onChange={props.onSearchChange} />
    <FilterSeg filter={props.filter} onChange={props.onFilterChange} counts={props.countsByFilter} />
    <Select
      value={props.dbType}
      onChange={props.onDbTypeChange}
      options={props.dbTypeOptions}
      placeholder="DB Type · 전체"
      aria-label="DB Type 필터"
    />
    <Select
      value={props.region}
      onChange={props.onRegionChange}
      options={props.regionOptions}
      placeholder="Region · 전체"
      aria-label="Region 필터"
    />
    <span className={cn('ml-auto text-[12px]', textColors.tertiary, numericFeatures.tabular)}>
      <strong className={cn('font-semibold', textColors.secondary)}>
        {props.visibleStart}–{props.visibleEnd}
      </strong>{' '}
      / {props.totalCount}건
    </span>
  </div>
);

interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
}

const SearchBox = ({ value, onChange }: SearchBoxProps) => (
  <label
    className={cn(
      'flex h-8 items-center gap-1.5 rounded-md border px-2 min-w-[220px]',
      borderColors.default,
    )}
  >
    <SearchIcon className={cn('h-3.5 w-3.5', textColors.tertiary)} aria-hidden="true" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Resource ID 또는 Name 검색"
      className={cn('w-full bg-transparent text-[13px] outline-none', textColors.primary)}
      aria-label="리소스 검색"
    />
  </label>
);

interface FilterSegProps {
  filter: ApprovalFilter;
  onChange: (next: ApprovalFilter) => void;
  counts: { all: number; target: number; excluded: number };
}

const FILTER_BUTTONS: ReadonlyArray<{ value: ApprovalFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'target', label: '대상' },
  { value: 'excluded', label: '비대상' },
];

const FilterSeg = ({ filter, onChange, counts }: FilterSegProps) => (
  <div
    className={cn('inline-flex h-8 items-center gap-0.5 rounded-md border p-0.5', borderColors.default)}
    role="group"
    aria-label="대상 필터"
  >
    {FILTER_BUTTONS.map((btn) => {
      const active = filter === btn.value;
      return (
        <button
          key={btn.value}
          type="button"
          onClick={() => onChange(btn.value)}
          aria-pressed={active}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 text-[12px] font-medium transition-colors',
            active ? cn(primaryColors.bg, textColors.inverse) : interactiveColors.inactiveTab,
          )}
        >
          {btn.label}
          <span
            className={cn(
              'text-[11px] font-semibold',
              numericFeatures.tabular,
              active ? textColors.inverse : textColors.tertiary,
            )}
          >
            {counts[btn.value]}
          </span>
        </button>
      );
    })}
  </div>
);

interface SelectProps {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder: string;
  'aria-label'?: string;
}

const Select = ({
  value,
  onChange,
  options,
  placeholder,
  'aria-label': ariaLabel,
}: SelectProps) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={cn('h-8 rounded-md border px-2 text-[13px]', borderColors.default, textColors.primary)}
    aria-label={ariaLabel}
  >
    <option value="">{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);
