'use client';

import Link from 'next/link';
import { cn, statusColors } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';

interface ScanErrorStateProps {
  onRetry: () => void;
}

export const ScanErrorState = ({ onRetry }: ScanErrorStateProps) => (
  <div className="py-[60px] px-5 text-center">
    <div
      className={cn(
        'mx-auto mb-5 max-w-[480px] rounded-[10px] border px-[18px] py-[14px] flex items-start gap-3 text-left',
        statusColors.error.bg,
        statusColors.error.border,
      )}
    >
      <svg
        className={cn('w-5 h-5 mt-0.5 flex-shrink-0', statusColors.error.text)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <h4 className={cn('mb-1 text-[13.5px] font-semibold', statusColors.error.textDark)}>
          인프라 스캔에 실패하였어요
        </h4>
        <p className={cn('text-[12.5px]', statusColors.error.textDark)}>
          보안 설정 또는 권한 문제로 스캔에 실패하였어요.{' '}
          <Link href="#" className="underline hover:no-underline">가이드 문서</Link>
          를 확인 후 권한 재설정 후 다시 시도해 주세요.
        </p>
      </div>
    </div>
    <Button variant="secondary" onClick={onRetry} className="inline-flex items-center gap-1.5 text-sm">
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      다시 시도
    </Button>
  </div>
);

export default ScanErrorState;
