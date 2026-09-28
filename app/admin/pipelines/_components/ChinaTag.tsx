'use client';

/**
 * ChinaTag — the 「중국」 chip beside a provider.
 *
 * Same word (`common.china`) and same recipe (`opsStyles.regionTag`) as the service
 * detail's target cards, so a target wears one chip on every admin surface. Drawn on
 * the flag alone: an SDU row keeps it, because where the data lives is the target's
 * own fact. There is no Global counterpart — Global is the absence of this chip.
 *
 * `leading-[11px]` holds the chip at 15px, inside the shortest line it sits on (the
 * request header's 12px/1.3 value line, 15.6px). At the inherited line height it is 18px:
 * the requests table grew 1px per 중국 row and the header's value line moved.
 */
import type { ReactElement } from 'react';
import { useLocale } from '@/app/components/LocaleProvider';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/theme';

export function ChinaTag(): ReactElement {
  const { locale } = useLocale();
  return (
    <span className={cn(opsStyles.regionTag, 'flex-none whitespace-nowrap leading-[11px]')}>
      {COPY[locale].common.china}
    </span>
  );
}
