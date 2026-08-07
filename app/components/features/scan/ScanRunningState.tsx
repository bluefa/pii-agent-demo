'use client';

import { bgColors, cn, primaryColors, textColors } from '@/lib/theme';

interface ScanRunningStateProps {
  progress: number;
  /**
   * 리소스 탐색은 끝났고 집계만 남은 구간. 바는 이미 가득 차 있으므로, 이때
   * "진행중" 문구를 그대로 두면 다 끝났는데 멈춘 화면으로 읽힌다.
   */
  finalizing: boolean;
}

export const ScanRunningState = ({ progress, finalizing }: ScanRunningStateProps) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="py-[60px] px-5 text-center">
      <div className={cn('w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center', bgColors.muted, textColors.tertiary)}>
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
        {finalizing ? '스캔 마무리 중이에요' : '인프라 스캔 진행중입니다'}
      </h3>
      <p className={cn('text-[13px]', textColors.tertiary)}>
        {finalizing ? (
          '리소스 탐색은 끝났고 결과를 집계하고 있어요. 잠시만 기다려 주세요.'
        ) : (
          <>인프라 스캔은 약 <strong>5분</strong> 이내 소요되는 편이며, 리소스가 많을 경우 길어질 수 있어요.</>
        )}
      </p>
      <div className={cn('mx-auto mt-6 max-w-[520px] rounded-full h-[10px] overflow-hidden', bgColors.panel)}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-[400ms] ease-out', primaryColors.barGradient)}
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
