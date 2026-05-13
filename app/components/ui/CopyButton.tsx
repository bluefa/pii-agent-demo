'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, CopyIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, interactiveColors, statusColors, textColors } from '@/lib/theme';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export const CopyButton = ({ value, label, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[CopyButton] clipboard.writeText failed', { error, value });
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? `${value} 복사`}
      className={cn(
        'inline-grid h-[22px] w-[22px] place-items-center rounded-md',
        'transition-opacity transition-colors',
        copied ? statusColors.success.textDark : textColors.quaternary,
        interactiveColors.closeButton,
        className,
      )}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};
