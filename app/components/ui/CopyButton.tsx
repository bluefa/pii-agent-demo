'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, CopyIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { cn } from '@/lib/theme';

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
      console.warn('[CopyButton] clipboard.writeText failed', { error, label });
    }
  }, [value, label]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? `${value} 복사`}
      className={cn(
        'inline-grid h-[22px] w-[22px] place-items-center rounded-[5px]',
        'transition-opacity transition-colors',
        copied
          ? 'text-[#45CB85]'
          : 'text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]',
        className,
      )}
    >
      {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
    </button>
  );
};
