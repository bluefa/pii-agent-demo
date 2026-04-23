'use client';

import { cn, bgColors, textColors } from '@/lib/theme';

export const ScanEmptyState = () => (
  <div className="py-[60px] px-5 text-center">
    <div
      className={cn(
        'w-16 h-16 mx-auto mb-5 rounded-2xl grid place-items-center',
        bgColors.muted,
        textColors.quaternary,
      )}
    >
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </div>
    <h3 className={cn('text-base font-semibold mb-1.5', textColors.primary)}>
      인프라 스캔을 진행해주세요
    </h3>
    <p className={cn('text-[13px]', textColors.tertiary)}>
      &apos;Run Infra Scan&apos;을 통해 부위 DB를 조회할 수 있어요
    </p>
  </div>
);

export default ScanEmptyState;
