import type { FC } from 'react';
import { AwsIcon, AzureIcon, GcpIcon, IdcIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, providerColors } from '@/lib/theme';
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
  className?: string;
}

export const ProviderLogo = ({ provider, isSdu, className }: ProviderLogoProps) => {
  if (isSdu) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-10 h-10 rounded-lg',
          providerColors.SDU.bg,
          providerColors.SDU.text,
          className,
        )}
        aria-label="SDU"
      >
        <SduIcon className="w-5 h-5" />
      </span>
    );
  }
  const colors = providerColors[provider];
  const Icon = PROVIDER_ICON[provider];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-lg',
        colors.bg,
        colors.text,
        className,
      )}
      aria-label={provider}
    >
      <Icon className="w-5 h-5" />
    </span>
  );
};
