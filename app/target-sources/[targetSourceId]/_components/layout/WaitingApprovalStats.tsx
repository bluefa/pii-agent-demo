import type { ApprovalFilter } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import { cn, numericFeatures } from '@/lib/theme';

interface WaitingApprovalStatsProps {
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
}

/** The three tiles double as the 전체/연동 대상/연동 제외대상 filter (replaces the toolbar segment). */
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
      label="연동 대상"
      value={selectedCount}
      unit="건"
      active={filter === 'target'}
      onClick={() => onFilterChange('target')}
    />
    <StatTile
      label="연동 제외대상"
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
      active
        ? 'bg-white ring-2 ring-inset ring-[#191F28]'
        : 'bg-[#F7F8FA] hover:bg-[#ECEEF1]',
      onClick && 'cursor-pointer text-left',
    )}
  >
    {/* 라벨은 값과 나란한 상위 계층 — 단위(건)보다 진하고 굵게 잡아 가시성을 확보한다. */}
    <div
      className={cn(
        'flex items-center gap-1.5',
        variant === 'modal'
          ? 'text-[11.5px] font-semibold text-[#8B95A1]'
          : 'text-[13px] font-bold text-[#4E5968]',
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
          'font-extrabold leading-[1.1] text-[#191F28]',
          variant === 'modal' ? 'text-[30px] tracking-[-0.035em]' : 'text-[40px] tracking-[-0.03em]',
          numericFeatures.tabular,
        )}
      >
        {value}
      </span>
      {/* 단위는 값에 붙는 꼬리표 — 라벨보다 옅고 가볍게 두어 계층을 낮춘다. */}
      <span
        className={cn(
          'ml-1 text-[13px]',
          variant === 'modal' ? 'font-semibold text-[#8B95A1]' : 'font-medium text-[#B0B8C1]',
        )}
      >
        {unit}
      </span>
    </div>
  </Tag>
  );
};
