'use client';

import { SearchIcon } from '@/app/components/ui/icons';
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
  visibleStart: number;
  visibleEnd: number;
  totalCount: number;
}

export const WaitingApprovalToolbar = (props: WaitingApprovalToolbarProps) => (
  // .table-toolbar — #F7F8FA surface, radius 12 12 0 0 (attached to table top),
  // 14/16 padding, gap 10, no bottom border (v15 lines 2583–2591).
  <div className="flex flex-wrap items-center gap-[10px] rounded-t-[12px] bg-[#F7F8FA] px-[16px] py-[14px]">
    <SearchBox value={props.searchValue} onChange={props.onSearchChange} />
    <FilterSeg filter={props.filter} onChange={props.onFilterChange} counts={props.countsByFilter} />
    <Divider />
    {/* v16: step 3 (applying) leads with 연동 상태; step 2 (waiting) leads with DB Type + Region. */}
    {props.variant === 'applying' && (
      <Select
        value={props.integrationStatus}
        onChange={props.onIntegrationStatusChange}
        options={props.integrationStatusOptions}
        placeholder="연동 상태 · 전체"
        aria-label="연동 상태 필터"
      />
    )}
    <Select
      value={props.dbType}
      onChange={props.onDbTypeChange}
      options={props.dbTypeOptions}
      placeholder="DB Type · 전체"
      aria-label="DB Type 필터"
    />
    {props.variant !== 'applying' && (
      <Select
        value={props.region}
        onChange={props.onRegionChange}
        options={props.regionOptions}
        placeholder="Region · 전체"
        aria-label="Region 필터"
      />
    )}
    {/* .tt-count — strong #111827 (not gray-700) (v15 lines 2673–2677). */}
    <span className={cn('ml-auto text-[12px] text-[#6B7280]', numericFeatures.tabular)}>
      <strong className="font-semibold text-[#111827]">
        {props.visibleStart}–{props.visibleEnd}
      </strong>{' '}
      / {props.totalCount}건
    </span>
  </div>
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
      className="h-8 w-full rounded-[8px] border border-[#E5E7EB] bg-white pl-[32px] pr-[12px] text-[12.5px] text-[#111827] outline-none focus:border-[#0064FF] focus:shadow-[0_0_0_3px_rgba(0,100,255,0.08)]"
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
  { value: 'target', label: '대상' },
  { value: 'excluded', label: '비대상' },
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
            'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[14px] text-[13px] transition-colors',
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
              'rounded-[999px] px-[7px] py-px text-[11.5px] font-bold',
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

interface SelectProps {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder: string;
  'aria-label'?: string;
}

// .tt-select chevron — inline data-URI SVG, stroke #9CA3AF, right 8px center, no-repeat (v15 line 2665).
const SELECT_CHEVRON =
  "#fff url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\") right 8px center no-repeat";

// .tt-select — h30, 1px #E5E7EB, radius 7, 12px, #111827, min-width 130,
// appearance:none + data-URI chevron, focus border #0064FF (v15 lines 2659–2671).
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
    style={{ background: SELECT_CHEVRON }}
    className="h-[30px] min-w-[130px] cursor-pointer appearance-none rounded-[7px] border border-[#E5E7EB] pl-[10px] pr-[28px] text-[12px] text-[#111827] outline-none focus:border-[#0064FF]"
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
