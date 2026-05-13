import { cn, statusColors, textColors } from '@/lib/theme';

export type ScanPillState = 'integrated' | 'pending' | 'new' | 'changed' | 'none';

interface ScanPillProps {
  state: ScanPillState;
}

interface ScanPillPalette {
  bg: string;
  text: string;
  dot: string;
  label: string;
}

// 'pending' and 'changed' share the warning palette by design — prototype
// renders both in orange. The two states are semantically distinct
// (in-flight vs. "different from last scan"); only the label diverges.
const PALETTE: Record<Exclude<ScanPillState, 'none'>, ScanPillPalette> = {
  integrated: {
    bg: statusColors.success.bg,
    text: statusColors.success.textDark,
    dot: statusColors.success.dot,
    label: 'Integrated',
  },
  pending: {
    bg: statusColors.warning.bg,
    text: statusColors.warning.textDark,
    dot: statusColors.warning.dot,
    label: 'Pending',
  },
  new: {
    bg: statusColors.info.bg,
    text: statusColors.info.textDark,
    dot: statusColors.info.dot,
    label: 'New',
  },
  changed: {
    bg: statusColors.warning.bg,
    text: statusColors.warning.textDark,
    dot: statusColors.warning.dot,
    label: 'Changed',
  },
};

export const ScanPill = ({ state }: ScanPillProps) => {
  if (state === 'none') {
    return <span className={cn('text-[12px]', textColors.quaternary)}>—</span>;
  }
  const palette = PALETTE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium',
        palette.bg,
        palette.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
      {palette.label}
    </span>
  );
};
