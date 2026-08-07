/**
 * ProvTag — provider glyph + neutral label.
 *
 * The mark used to be a brand-coloured square. A swatch says nothing the label does
 * not already say, and it spent a hue on every row of every admin table — so the
 * provider's own glyph replaces it, monotone, inheriting the label's colour. Same
 * shared source as the target-source cards (`ProviderGlyph`), so a provider looks
 * the same everywhere it appears.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/pipeline/types';

export interface ProvTagProps {
  provider: CloudProvider | string;
  /** An SDU target reads as "SDU" over its underlying CSP. */
  isSdu?: boolean;
  /**
   * `lg` = 16/600 for blocks where the provider IS the heading (Jira tiles).
   * A size prop rather than a className override: `cn` is a plain join, so a
   * second text-[..] class would collide with the base and let CSS order decide.
   */
  size?: 'md' | 'lg';
  className?: string;
}

export function ProvTag({ provider, isSdu, size, className }: ProvTagProps): ReactElement {
  const { provTag } = pipelineStyles;
  const shown = displayProvider(provider, isSdu);
  return (
    <span className={cn(size === 'lg' ? provTag.baseLg : provTag.base, className)}>
      {/* Nothing renders for UNKNOWN — the flex gap would otherwise indent the label
          on exactly the rows that have the least to say. */}
      <ProviderGlyph provider={shown} className={size === 'lg' ? provTag.glyphLg : provTag.glyph} />
      {providerLabel(shown)}
    </span>
  );
}
