'use client';

import Link from 'next/link';
import { cn, statusColors } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';
import { useLocale } from '@/app/components/LocaleProvider';
import { SCAN_COPY } from '@/app/components/features/scan/copy';

interface ScanErrorStateProps {
  onRetry: () => void;
}

export const ScanErrorState = ({ onRetry }: ScanErrorStateProps) => {
  const { locale } = useLocale();
  const t = SCAN_COPY[locale];

  return (
    <div className="py-[60px] px-5 text-center">
      <div className="mx-auto mb-5 max-w-[480px] rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-[18px] py-[14px] flex items-start gap-3 text-left">
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
            {t.failTitle}
          </h4>
          <p className="text-[12.5px] text-[#7F1D1D]">
            {t.failBodyBefore}{' '}
            <Link href="#" className="underline hover:no-underline">{t.failBodyLink}</Link>
            {t.failBodyAfter}
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
        {t.tryAgain}
      </Button>
    </div>
  );
};

export default ScanErrorState;
