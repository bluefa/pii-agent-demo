'use client';

import type { InstallTaskStatus } from '@/lib/constants/install-task';
import { cn } from '@/lib/theme';

interface InstallTaskCardProps {
  num: number;
  title: string;
  sub?: string;
  status: InstallTaskStatus;
  completedCount?: number;
  activeCount?: number;
  onClick?: () => void;
  showConnector?: boolean;
}

/**
 * Step-number badge. v15 `.install-task .num` — 32px circle, 14/800, base
 * #fff bg / #8B95A1 text; done #45CB85/#fff; running #0064FF/#fff + halo.
 */
const NUM_STYLES: Record<InstallTaskStatus, string> = {
  pending: 'bg-white text-[#8B95A1] shadow-[0_1px_2px_rgba(17,24,39,0.04)]',
  done: 'bg-[#45CB85] text-white',
  running: 'bg-[#0064FF] text-white shadow-[0_0_0_4px_rgba(0,100,255,0.15)]',
  failed: 'bg-[#991B1B] text-white',
};

/**
 * Status pill. v15 `.status-pill` base (대기) = #fff / #8B95A1; 완료 #fff /
 * #2A7D52; 진행중 #0064FF bg / #fff text; 실패 #fff / #991B1B.
 */
const PILL_STYLES: Record<InstallTaskStatus, string> = {
  pending: 'bg-white text-[#8B95A1]',
  done: 'bg-white text-[#2A7D52]',
  running: 'bg-[#0064FF] text-white',
  failed: 'bg-white text-[#991B1B]',
};

const PILL_LABEL: Record<InstallTaskStatus, string> = {
  pending: '대기',
  done: '완료',
  running: '진행중',
  failed: '실패',
};

/**
 * Card-level background. v15: base #F7F8FA; `.done` #ECFDF5;
 * `.running` #EFF6FF + inset 1.5px ring rgba(0,100,255,0.12).
 * `.failed` keeps the base surface (no card-level rule in v15).
 */
const CARD_BG: Record<InstallTaskStatus, string> = {
  pending: 'bg-[#F7F8FA]',
  done: 'bg-[#ECFDF5]',
  running: 'bg-[#EFF6FF] shadow-[inset_0_0_0_1.5px_rgba(0,100,255,0.12)]',
  failed: 'bg-[#F7F8FA]',
};

/**
 * Connector glyph. v15 `.install-task:not(:last-child)::after` — `›` chevron
 * (U+203A), right -14, color #B0B8C1, 22px / 700 / line-height 1.
 */
const CONNECTOR_CLASS = cn(
  'absolute right-[-14px] top-1/2 -translate-y-1/2 z-[2]',
  'flex items-center justify-center pointer-events-none',
  'text-[22px] font-bold leading-none text-[#B0B8C1]',
);

export const InstallTaskCard = ({
  num,
  title,
  sub,
  status,
  onClick,
  showConnector,
}: InstallTaskCardProps) => {
  // v16 `.status-pill` is a plain label ('진행중'/'완료') with no count suffix.
  const pillText = PILL_LABEL[status];

  const containerClass = cn(
    'flex flex-col items-start text-left gap-3 px-[22px] py-6',
    'border-0 rounded-xl relative',
    CARD_BG[status],
    onClick && 'cursor-pointer hover:bg-white',
  );

  const numClass = cn(
    'w-8 h-8 rounded-full grid place-items-center',
    'text-[14px] font-extrabold flex-shrink-0',
    NUM_STYLES[status],
  );

  const pillClass = cn(
    'mt-1 text-[12px] font-bold px-3 py-[5px] rounded-full tracking-[-0.01em]',
    PILL_STYLES[status],
  );

  const innerContent = (
    <>
      <span className={numClass}>{num}</span>
      <div className="w-full min-w-0 flex flex-col items-start gap-1.5">
        <div className="text-[16px] font-bold leading-[1.35] tracking-[-0.02em] text-[#191F28]">
          {title}
        </div>
        {sub ? (
          <div className="text-[13px] font-medium leading-[1.55] text-[#4E5968]">
            {sub}
          </div>
        ) : null}
        <span className={pillClass}>{pillText}</span>
      </div>
      {showConnector ? (
        <span aria-hidden="true" className={CONNECTOR_CLASS}>
          ›
        </span>
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
