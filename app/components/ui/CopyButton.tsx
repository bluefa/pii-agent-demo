'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, CopyIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { useLocale } from '@/app/components/LocaleProvider';
import { COPY } from '@/lib/copy';
import { bgColors, cn, primaryColors, statusColors, textColors } from '@/lib/theme';

interface CopyButtonProps {
  value: string;
  label?: string;
  text?: string;
  className?: string;
}

export const CopyButton = ({ value, label, text, className }: CopyButtonProps) => {
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[CopyButton] clipboard.writeText failed', { error, label });
    }
  }, [value, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? COPY[locale].common.copyValue(value)}
      className={cn(
        'inline-flex items-center justify-center rounded-[5px]',
        text ? 'h-8 gap-1.5 px-2.5 text-[13px] font-medium' : 'h-[22px] w-[22px]',
        'transition-opacity transition-colors',
        copied
          ? statusColors.success.text
          : cn(textColors.tertiary, bgColors.mutedHover, primaryColors.textHover),
        className,
      )}
    >
      {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
      {text}
    </button>
  );
};
