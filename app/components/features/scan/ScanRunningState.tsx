'use client';

import { cn, primaryColors, textColors } from '@/lib/theme';

interface ScanRunningStateProps {
  progress: number;
}

export const ScanRunningState = ({ progress }: ScanRunningStateProps) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="py-[60px] px-5 text-center">
      <div
        className={cn(
          'w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center',
          primaryColors.bgLight,
          primaryColors.text,
        )}
      >
        <div className="animate-spin">
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>
      <h3 className={cn('text-base font-semibold mb-1.5', textColors.primary)}>
        인프라 스캔 진행중입니다
      </h3>
      <p className={cn('text-[13px]', textColors.tertiary)}>
        인프라 스캔은 약 <strong>5분</strong> 이내 소요되는 편이며, 리소스가 많을 경우 길어질 수 있어요.
      </p>
      <div className="mx-auto mt-6 max-w-[520px] bg-slate-100 rounded-full h-[10px] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0064FF] to-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className={cn('mt-2 text-xs font-mono tabular-nums', textColors.secondary)}>
        {clamped}%
      </div>
    </div>
  );
};

export default ScanRunningState;
