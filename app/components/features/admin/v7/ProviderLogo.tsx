import { ProviderGlyph } from '@/app/components/ui/CloudProviderIcon';
import { cn, providerColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

interface ProviderLogoProps {
  provider: CloudProvider;
  isSdu?: boolean;
  /**
   * `bare` drops both the brand hue and the tile: a large monotone mark on the card's
   * own surface. Where the provider repeats down every row of a list, five brand
   * colours make that column the loudest thing on the page while carrying the least
   * information — the mark's shape already says which provider it is, and at 36px it
   * says it without a tile to hold it.
   */
  variant?: 'tile' | 'bare';
  /**
   * `brand` paints a bare mark in the vendor's own colours. Opt-in, for the one
   * place a provider appears — a page header — where the reasoning above (five
   * hues down a list column) does not apply. Ignored by `tile`, which is already
   * brand-coloured. IDC and SDU are ours and stay on currentColor either way.
   */
  tone?: 'mono' | 'brand';
  className?: string;
}

export const ProviderLogo = ({
  provider,
  isSdu,
  variant = 'tile',
  tone = 'mono',
  className,
}: ProviderLogoProps) => {
  const colors = providerColors[isSdu ? 'SDU' : provider];
  const bare = variant === 'bare';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        bare ? cn('w-16 h-16', textColors.secondary) : cn('w-10 h-10', colors.bg, colors.text),
        className,
      )}
      aria-label={isSdu ? 'SDU' : provider}
    >
      <ProviderGlyph
        provider={provider}
        isSdu={isSdu}
        tone={bare ? tone : 'mono'}
        className={bare ? 'w-9 h-9' : 'w-5 h-5'}
      />
    </span>
  );
};
