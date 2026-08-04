import type { ReactNode } from 'react';
import type { ApprovalFilter } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar';
import {
  borderColors,
  cn,
  numericFeatures,
  primaryColors,
  statusColors,
  textColors,
  tossShadow,
} from '@/lib/theme';

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
  /** 값 아래 한 줄 보조 텍스트. 색은 호출자가 소유한다(경고 / 중립). */
  note?: ReactNode;
  /**
   * 타일 자신이 경고를 지는 상태 — 선택되지 않았을 때 테두리가 경고색이 된다. 선택 시에는
   * 브랜드 경계가 이깁니다: 선택은 오직 경계로만 말하기 때문에(위 주석), 경고는 note 가 잇는다.
   */
  tone?: 'warning';
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
  note,
  tone,
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
              // 경고 테두리는 흰 면 위에서 그 자체가 신호이므로 orange-600 (3.56:1,
              // WCAG 1.4.11 비텍스트 3:1) — statusColors.warning.borderStrong 과 같은 근거.
              : tone === 'warning'
                ? statusColors.warning.borderStrong
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
          ? 'text-[12px] font-semibold text-[#6B7684]'
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
    {/* 라벨과 같은 12.5/500 한 줄. 색은 호출자가 정한다 — 경고인지 중립인지는 타일이 모른다. */}
    {note && <div className="text-[12.5px] font-medium leading-[1.4]">{note}</div>}
  </Tag>
  );
};
