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
  /**
   * `link` = the row this sits in IS a link and the provider is one of the
   * identifiers you click it by (dashboard 대상 열). A prop for the same reason
   * `size` is one — the colour cannot come in through `className`.
   */
  tone?: 'default' | 'link';
  className?: string;
}

export function ProvTag({ provider, isSdu, size, tone, className }: ProvTagProps): ReactElement {
  const { provTag } = pipelineStyles;
  const shown = displayProvider(provider, isSdu);
  const lg = size === 'lg';
  return (
    <span
      className={cn(
        lg ? provTag.baseLg : provTag.base,
        // Exactly ONE colour class ever lands here — see the token comment.
        tone === 'link' ? provTag.toneLink : lg ? provTag.toneLg : provTag.tone,
        className,
      )}
    >
      {/* Nothing renders for UNKNOWN — the flex gap would otherwise indent the label
          on exactly the rows that have the least to say. */}
      <ProviderGlyph provider={shown} className={lg ? provTag.glyphLg : provTag.glyph} />
      {providerLabel(shown)}
    </span>
  );
}
