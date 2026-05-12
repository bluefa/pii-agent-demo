import { bgColors, borderColors, cn, numericFeatures, primaryColors, textColors } from '@/lib/theme';

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
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="전체 요청" value={totalCount} unit="건" />
      <StatTile label="연동 대상" value={selectedCount} unit="건" pct={selectedPct} swatch="target" />
      <StatTile label="비대상" value={excludedCount} unit="건" pct={excludedPct} swatch="exclude" />
    </div>
  );
};

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  pct?: number;
  swatch?: 'target' | 'exclude';
}

const StatTile = ({ label, value, unit, pct, swatch }: StatTileProps) => (
  <div className={cn('rounded-xl border px-4 py-3', borderColors.default, bgColors.surface)}>
    <div className={cn('flex items-center gap-1.5 text-[12px] font-medium', textColors.tertiary)}>
      {swatch && (
        <span
          className={cn('h-2 w-2 rounded-full', swatch === 'target' ? primaryColors.bg : bgColors.strong)}
        />
      )}
      {label}
    </div>
    <div className={cn('mt-1 flex items-baseline gap-1.5', textColors.primary)}>
      <span className={cn('text-[22px] font-extrabold tracking-[-0.02em]', numericFeatures.tabular)}>
        {value}
      </span>
      <span className={cn('text-[12px]', textColors.tertiary)}>{unit}</span>
      {pct !== undefined && (
        <span className={cn('text-[12px]', textColors.tertiary)}>· {pct.toFixed(1)}%</span>
      )}
    </div>
  </div>
);
