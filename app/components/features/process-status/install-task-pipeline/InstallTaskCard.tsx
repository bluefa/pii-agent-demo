'use client';

import type { InstallTaskStatus } from '@/lib/constants/gcp';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  statusColors,
  tagStyles,
  textColors,
} from '@/lib/theme';

export type InstallTaskCardPosition = 'first' | 'middle' | 'last';

interface InstallTaskCardProps {
  num: number;
  title: string;
  sub?: string;
  status: InstallTaskStatus;
  completedCount?: number;
  activeCount?: number;
  onClick?: () => void;
  position: InstallTaskCardPosition;
  showConnector?: boolean;
}

const NUM_STYLES: Record<InstallTaskStatus, string> = {
  pending: cn(bgColors.muted, textColors.tertiary),
  done: cn(statusColors.success.dot, textColors.inverse),
  running: cn(primaryColors.bg, textColors.inverse, primaryColors.haloRing),
  failed: cn(statusColors.error.dot, textColors.inverse),
};

const PILL_STYLES: Record<InstallTaskStatus, string> = {
  pending: tagStyles.neutral,
  done: tagStyles.success,
  running: tagStyles.info,
  failed: tagStyles.error,
};

const PILL_LABEL: Record<InstallTaskStatus, string> = {
  pending: '해당없음',
  done: '완료',
  running: '진행중',
  failed: '실패',
};

const POSITION_CLASS: Record<InstallTaskCardPosition, string> = {
  first: 'rounded-l-[10px] border-r-0',
  middle: 'border-r-0',
  last: 'rounded-r-[10px]',
};

const CONNECTOR_CLASS = cn(
  'absolute right-[-7px] top-1/2 w-3.5 h-3.5 rotate-45',
  '-translate-y-1/2 pointer-events-none z-10',
  'border-t border-r',
);

export const InstallTaskCard = ({
  num,
  title,
  sub,
  status,
  completedCount,
  activeCount,
  onClick,
  position,
  showConnector,
}: InstallTaskCardProps) => {
  const showCount = status === 'running' && typeof activeCount === 'number';
  const pillText = showCount
    ? `${PILL_LABEL[status]} (${completedCount ?? 0}/${activeCount})`
    : PILL_LABEL[status];

  const containerClass = cn(
    'flex flex-col items-center text-center gap-3 px-[18px] pt-[22px] pb-5',
    'border relative',
    bgColors.surface,
    borderColors.default,
    POSITION_CLASS[position],
    onClick && cn('cursor-pointer', bgColors.mutedHover),
  );

  const numClass = cn(
    'w-[30px] h-[30px] rounded-full grid place-items-center',
    'text-[13px] font-bold flex-shrink-0',
    NUM_STYLES[status],
  );

  const pillClass = cn(
    'mt-1 text-[11px] font-semibold px-3 py-1 rounded-full',
    PILL_STYLES[status],
  );

  const innerContent = (
    <>
      <span className={numClass}>{num}</span>
      <div className="w-full min-w-0 flex flex-col items-center gap-1.5">
        <div className={cn('text-[15px] font-bold leading-snug', textColors.primary)}>
          {title}
        </div>
        {sub ? (
          <div className={cn('text-xs leading-relaxed', textColors.tertiary)}>
            {sub}
          </div>
        ) : null}
        <span className={pillClass}>{pillText}</span>
      </div>
      {showConnector ? (
        <span
          aria-hidden="true"
          className={cn(CONNECTOR_CLASS, bgColors.surface, borderColors.default)}
        />
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={containerClass}>
        {innerContent}
      </button>
    );
  }

  return <div className={containerClass}>{innerContent}</div>;
};
