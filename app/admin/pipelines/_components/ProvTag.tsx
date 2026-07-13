/**
 * ProvTag — neutral provider label + brand-colored dot (design-inventory §3
 * `.ptag`). Dot color is keyed by the lowercased provider (wire is UPPERCASE).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { displayProvider, providerKey, providerLabel } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/pipeline/types';

export interface ProvTagProps {
  provider: CloudProvider | string;
  /** An SDU target reads as "SDU" over its underlying CSP. */
  isSdu?: boolean;
  className?: string;
}

export function ProvTag({ provider, isSdu, className }: ProvTagProps): ReactElement {
  const { provTag } = pipelineStyles;
  const shown = displayProvider(provider, isSdu);
  const key = providerKey(shown);
  return (
    <span className={cn(provTag.base, className)}>
      <span className={cn(provTag.dot, provTag.dotTone[key] ?? 'bg-[var(--pl-gray-300)]')} />
      {providerLabel(shown)}
    </span>
  );
}
