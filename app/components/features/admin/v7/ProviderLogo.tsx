import type { FC } from 'react';
import { AwsIcon, AzureIcon, GcpIcon, IdcIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, providerColors, textColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

const PROVIDER_ICON: Record<CloudProvider, FC<{ className?: string }>> = {
  AWS: AwsIcon,
  Azure: AzureIcon,
  GCP: GcpIcon,
  IDC: IdcIcon,
};

const SduIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
    <line x1="7" y1="17" x2="7.01" y2="17" />
  </svg>
);

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
  className?: string;
}

export const ProviderLogo = ({
  provider,
  isSdu,
  variant = 'tile',
  className,
}: ProviderLogoProps) => {
  const Icon = isSdu ? SduIcon : PROVIDER_ICON[provider];
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
      <Icon className={bare ? 'w-9 h-9' : 'w-5 h-5'} />
    </span>
  );
};
