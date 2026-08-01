import type { ApprovalFilter } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { borderColors, cn, numericFeatures, primaryColors, textColors, tossShadow } from '@/lib/theme';

interface WaitingApprovalStatsProps {
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
}

/** The three tiles double as the all / target / excluded filter (replaces the toolbar segment). */
export const WaitingApprovalStats = ({
  totalCount,
  selectedCount,
  excludedCount,
  filter,
  onFilterChange,
}: WaitingApprovalStatsProps) => (
  <div className="grid grid-cols-3 gap-3 mb-[18px]" role="group" aria-label="대상 필터">
    <StatTile
      label="전체 요청"
      value={totalCount}
      unit="건"
      active={filter === 'all'}
      onClick={() => onFilterChange('all')}
    />
    <StatTile
      label="연동 요청 대상"
      value={selectedCount}
      unit="건"
      active={filter === 'target'}
      onClick={() => onFilterChange('target')}
    />
    <StatTile
      label="연동 요청 제외대상"
      value={excludedCount}
      unit="건"
      active={filter === 'excluded'}
      onClick={() => onFilterChange('excluded')}
    />
  </div>
);

export interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  swatch?: 'target' | 'exclude';
  /** `card` (default, centered, 32px num) vs `modal` (v16 req-modal override, left, 30px num). */
  variant?: 'card' | 'modal';
  /** Set on the filter tiles only — renders a button with a selected state. */
  onClick?: () => void;
  active?: boolean;
}

/** Single approval-stat tile — v16 `.approval-stat` (reused by the completion-approval modals). */
export const StatTile = ({
  label,
  value,
  unit,
  swatch,
  variant = 'card',
  onClick,
  active,
}: StatTileProps) => {
  const Tag = onClick ? 'button' : 'div';
  return (
  <Tag
    type={onClick ? 'button' : undefined}
    onClick={onClick}
    aria-pressed={onClick ? active : undefined}
    className={cn(
      'flex flex-col gap-1.5 rounded-xl px-5 py-[18px] transition-colors duration-150',
      variant === 'card' && 'items-center',
      // card = the step-1 submit-modal tile grammar (white card + gray-200 stroke +
      // toss lg shadow) so the two stats rows read as one design. Selection speaks
      // ONLY through the boundary: the 1px stroke turns brand and an inset ring
      // doubles it to a 2px edge — same surface, same shadow, no layout shift.
      // Unselected tiles preview that grammar on hover (1px brand stroke), which is
      // what keeps three identical white cards reading as a filter, not static stats.
      // modal = the legacy gray well, untouched (CloudReq/IdcReq approval modals).
      variant === 'card'
        ? cn(
            'border bg-white',
            tossShadow.lg,
            active
              ? 'border-[#0064FF] ring-1 ring-inset ring-[#0064FF]'
              : cn(borderColors.default, primaryColors.borderHoverBase),
          )
        : active
          ? 'bg-white ring-2 ring-inset ring-[#191F28]'
          : 'bg-[#F7F8FA] hover:bg-[#ECEEF1]',
      onClick && 'cursor-pointer text-left',
    )}
  >
    {/* The label is a peer of the value, so it stays darker and bolder than the unit suffix.
        card = the submit-modal tile ramp (14 semibold, quiet tier). */}
    <div
      className={cn(
        'flex items-center gap-1.5',
        variant === 'modal'
          ? 'text-[12px] font-semibold text-[#8B95A1]'
          : cn('text-[14px] font-semibold', textColors.tertiary),
      )}
    >
      {swatch && (
        <span
          className={cn('h-2 w-2 rounded-[2px]', swatch === 'target' ? 'bg-[#10B981]' : 'bg-[#D1D5DB]')}
        />
      )}
      {label}
    </div>
    <div className="flex items-baseline">
      <span
        className={cn(
          variant === 'modal'
            ? 'font-extrabold leading-[1.1] text-[#191F28] text-[30px] tracking-[-0.035em]'
            : cn('text-[40px] font-bold leading-[1.2]', textColors.primary),
          numericFeatures.tabular,
        )}
      >
        {value}
      </span>
      {/* The unit is a suffix of the value — lighter than the label so it reads one tier down. */}
      <span
        className={cn(
          'ml-1',
          textColors.tertiary,
          variant === 'modal' ? 'text-[12px] font-semibold' : 'text-[13px] font-medium',
        )}
      >
        {unit}
      </span>
    </div>
  </Tag>
  );
};
