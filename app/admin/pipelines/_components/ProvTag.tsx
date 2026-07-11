/**
 * ProvTag — neutral provider label + brand-colored dot (design-inventory §3
 * `.ptag`). Dot color is keyed by the lowercased provider (wire is UPPERCASE).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { providerKey, providerLabel } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/pipeline/types';

export interface ProvTagProps {
  provider: CloudProvider | string;
  className?: string;
}

export function ProvTag({ provider, className }: ProvTagProps): ReactElement {
  const { provTag } = pipelineStyles;
  const key = providerKey(provider);
  return (
    <span className={cn(provTag.base, className)}>
      <span className={cn(provTag.dot, provTag.dotTone[key] ?? 'bg-[var(--pl-gray-300)]')} />
      {providerLabel(provider)}
    </span>
  );
}
