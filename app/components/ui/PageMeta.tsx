'use client';

import { useState } from 'react';
import { CopyIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';
import { cn, interactiveColors, pageMetaStyles, statusColors } from '@/lib/theme';

export interface PageMetaItem {
  label: string;
  value: React.ReactNode;
  /** When true, the value is rendered with `font-mono` and a hover-revealed copy button.
   *  Copy target uses `copyText` if provided; otherwise the `value` when it is a plain string. */
  mono?: boolean;
  copyText?: string;
}

interface PageMetaProps {
  items: PageMetaItem[];
}

export const PageMeta = ({ items }: PageMetaProps) => (
  <dl className={pageMetaStyles.container}>
    {items.map((item, index) => (
      <PageMetaRow key={`${item.label}-${index}`} item={item} />
    ))}
  </dl>
);

const PageMetaRow = ({ item }: { item: PageMetaItem }) => {
  const [copied, setCopied] = useState(false);
  const copyTarget = item.copyText ?? (typeof item.value === 'string' ? item.value : null);
  const showCopyButton = item.mono === true && copyTarget !== null && copyTarget !== '';

  const handleCopy = async () => {
    if (!copyTarget) return;
    try {
      await navigator.clipboard.writeText(copyTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[PageMeta] clipboard.writeText failed', { error, label: item.label });
    }
  };

  return (
    <div className={pageMetaStyles.item}>
      <dt className={pageMetaStyles.key}>{item.label}</dt>
      <dd className="group flex min-w-0 items-center gap-1.5">
        <span className={cn(pageMetaStyles.value, item.mono && pageMetaStyles.mono, 'truncate')}>
          {item.value}
        </span>
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'shrink-0 rounded p-0.5 transition-opacity',
              copied
                ? cn('opacity-100', statusColors.success.textDark)
                : cn('opacity-0 group-hover:opacity-100', interactiveColors.closeButton),
            )}
            aria-label={`${item.label} 복사`}
          >
            {copied ? <StatusSuccessIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
};
