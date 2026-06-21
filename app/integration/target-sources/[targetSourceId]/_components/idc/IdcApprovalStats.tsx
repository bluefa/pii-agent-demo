import { cn, idcStyles, numericFeatures } from '@/lib/theme';
import type { IdcResourceView } from '@/app/lib/api/idc';

interface IdcApprovalStatsProps {
  resources: readonly IdcResourceView[];
}

/**
 * IDC Step-2 approval-stats grid — mirrors the cloud `WaitingApprovalStats`
 * (3-col borderless pills) adapted to IDC resource fields (`excluded`).
 */
export const IdcApprovalStats = ({ resources }: IdcApprovalStatsProps) => {
  const totalCount = resources.length;
  const excludedCount = resources.filter((r) => r.excluded).length;
  const selectedCount = totalCount - excludedCount;
  const selectedPct = totalCount === 0 ? 0 : Math.round((selectedCount / totalCount) * 1000) / 10;
  const excludedPct = totalCount === 0 ? 0 : Math.round((excludedCount / totalCount) * 1000) / 10;

  return (
    <div className="grid grid-cols-3 gap-3 mb-[18px]">
      <StatTile label="전체 요청" value={totalCount} unit="건" />
      <StatTile label="연동 대상" value={selectedCount} unit="건" pct={selectedPct} swatch="target" />
      <StatTile label="제외" value={excludedCount} unit="건" pct={excludedPct} swatch="exclude" />
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
  <div
    className={cn(
      'flex flex-col gap-1.5 rounded-xl px-5 py-[18px] transition-colors duration-150 hover:bg-[#ECEEF1]',
      idcStyles.tag.gray,
    )}
  >
    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8B95A1]">
      {swatch && (
        <span
          className={cn(
            'h-2 w-2 rounded-[2px]',
            swatch === 'target' ? idcStyles.targetPill.yes.dot : 'bg-[#D1D5DB]',
          )}
        />
      )}
      {label}
    </div>
    <div className="flex items-baseline">
      <span
        className={cn(
          'text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#191F28]',
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
