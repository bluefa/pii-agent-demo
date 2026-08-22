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
  /**
   * `null` = 아직 읽지 못한 값. 0 으로 접으면 못 읽은 것이 "0건"이라는 사실이 된다 —
   * 완료 승인 모달이 응답을 기다리는 동안 "제외한 논리 DB 0개"라고 단정하던 자리다.
   * 모르는 수에는 단위도 붙이지 않는다.
   */
  value: number | null;
  unit: string;
  swatch?: 'target' | 'exclude';
  /**
   * 숫자 크기. `page`(기본) 40px — 페이지 폭의 카드 위에 놓인 표시 숫자다.
   * `dialog` 24px — 확인 모달 안에서는 26px 제목이 위계의 꼭대기라, 40px 는 그 위로 올라선다.
   */
  scale?: 'page' | 'dialog';
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
  scale = 'page',
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
      'flex flex-col items-center gap-1.5 rounded-xl px-5 py-[18px] transition-colors duration-150',
      // The step-1 submit-modal tile grammar (white card + gray-200 stroke + toss lg
      // shadow) so every stats row in the flow reads as one design. Selection speaks
      // ONLY through the boundary: the 1px stroke turns brand and an inset ring
      // doubles it to a 2px edge — same surface, same shadow, no layout shift.
      // Unselected tiles preview that grammar on hover (1px brand stroke), which is
      // what keeps three identical white cards reading as a filter, not static stats.
      'border bg-white',
      tossShadow.lg,
      active
        ? 'border-[#0064FF] ring-1 ring-inset ring-[#0064FF]'
        : cn(borderColors.default, primaryColors.borderHoverBase),
      onClick && 'cursor-pointer text-left',
    )}
  >
    {/* The label is a peer of the value, so it stays darker and bolder than the unit suffix.
        The submit-modal tile ramp (14 semibold, quiet tier). */}
    <div className={cn('flex items-center gap-1.5 text-[14px] font-semibold', textColors.tertiary)}>
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
          // 한 조건에 한 문자열 — 두 갈래가 같은 속성을 겹쳐 쓰면 어느 쪽이 이길지
          // cn 이 아니라 Tailwind 가 CSS 에 찍는 순서가 정한다.
          scale === 'dialog' ? 'text-[24px]' : 'text-[40px]',
          'font-bold leading-[1.2]',
          value == null ? textColors.tertiary : textColors.primary,
          numericFeatures.tabular,
        )}
      >
        {value ?? '—'}
      </span>
      {/* The unit is a suffix of the value — lighter than the label so it reads one tier down.
          A value we could not read has no unit: "— 개" would still be claiming the kind of
          thing we counted, and we counted nothing. */}
      {/* 12px, not the 13 this line carried before the variant fold: the design guard
          only admits even sizes, and 12 is the tier the removed `modal` variant already
          used for this very suffix. */}
      {value != null && (
        <span className={cn('ml-1 text-[12px] font-medium', textColors.tertiary)}>{unit}</span>
      )}
    </div>
  </Tag>
  );
};
