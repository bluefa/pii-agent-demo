import { cn, numericFeatures } from '@/lib/theme';

interface WaitingApprovalStatsProps {
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
}

export const WaitingApprovalStats = ({
  totalCount,
  selectedCount,
  excludedCount,
}: WaitingApprovalStatsProps) => {
  const selectedPct = totalCount === 0 ? 0 : Math.round((selectedCount / totalCount) * 1000) / 10;
  const excludedPct = totalCount === 0 ? 0 : Math.round((excludedCount / totalCount) * 1000) / 10;

  return (
    <div className="grid grid-cols-3 gap-3 mb-[18px]">
      <StatTile label="전체 요청" value={totalCount} unit="건" />
      <StatTile label="연동 대상" value={selectedCount} unit="건" pct={selectedPct} swatch="target" />
      <StatTile label="비대상" value={excludedCount} unit="건" pct={excludedPct} swatch="exclude" />
    </div>
  );
};

export interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  pct?: number;
  swatch?: 'target' | 'exclude';
  /** `card` (default, 26px num) vs `modal` (v16 req-modal override, 30px num). */
  variant?: 'card' | 'modal';
}

/** Single approval-stat tile — v16 `.approval-stat` (reused by the completion-approval modals). */
export const StatTile = ({ label, value, unit, pct, swatch, variant = 'card' }: StatTileProps) => (
  <div className="flex flex-col gap-1.5 rounded-xl bg-[#F7F8FA] px-5 py-[18px] transition-colors duration-150 hover:bg-[#ECEEF1]">
    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8B95A1]">
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
          variant === 'modal' ? 'text-[30px] tracking-[-0.035em]' : 'text-[26px] tracking-[-0.03em]',
          numericFeatures.tabular,
        )}
      >
        {value}
      </span>
      <span className="ml-1 text-[13px] font-semibold text-[#8B95A1]">{unit}</span>
      {pct !== undefined && (
        <span className="ml-2 text-[13px] font-semibold text-[#8B95A1]">{pct.toFixed(1)}%</span>
      )}
    </div>
  </div>
);
