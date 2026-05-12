import type { ReactElement } from 'react';
import { cn, providerColors } from '@/lib/theme';
import type { CloudProvider } from '@/lib/types';

const PROVIDER_SVG: Record<CloudProvider, ReactElement> = {
  AWS: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M6.76 13.05c0 .29.03.53.09.7.07.18.15.37.27.58.04.07.06.13.06.19 0 .08-.05.16-.16.24l-.53.36c-.07.05-.15.08-.21.08-.08 0-.16-.04-.24-.12-.11-.12-.21-.25-.29-.38-.08-.14-.16-.3-.25-.49-.66.78-1.49 1.17-2.49 1.17-.71 0-1.27-.2-1.69-.61-.42-.41-.63-.95-.63-1.63 0-.72.25-1.31.77-1.74.51-.43 1.2-.65 2.07-.65.29 0 .58.02.89.07.31.04.63.11.96.18v-.61c0-.65-.13-1.1-.4-1.36-.27-.26-.74-.39-1.4-.39-.3 0-.61.04-.93.11-.32.07-.63.16-.93.28-.14.06-.24.1-.3.11-.06.02-.1.03-.13.03-.11 0-.17-.08-.17-.25v-.4c0-.13.02-.22.06-.28.04-.06.11-.12.22-.18.3-.15.66-.28 1.08-.39.42-.11.87-.17 1.35-.17 1.03 0 1.78.23 2.27.7.48.47.72 1.18.72 2.13v2.81zM18.85 17.36c-2.27 1.67-5.55 2.56-8.39 2.56-3.97 0-7.55-1.47-10.26-3.91-.21-.19-.02-.45.24-.3 2.92 1.69 6.52 2.71 10.24 2.71 2.51 0 5.27-.52 7.81-1.6.38-.17.7.25.36.54zm.95-1.08c-.29-.37-1.92-.18-2.65-.09-.22.03-.26-.16-.06-.31 1.3-.91 3.43-.65 3.68-.34.25.31-.07 2.45-1.28 3.47-.19.16-.36.07-.28-.13.27-.69.87-2.23.59-2.6z" />
    </svg>
  ),
  Azure: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M9.105 4.5L4.5 16.62l4.605 1.293L13.71 4.5H9.105zm5.355 1.137L11.587 13.5l4.83 5.43L9.27 19.5h12.273l-7.083-13.863z" />
    </svg>
  ),
  GCP: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-5 h-5">
      <path d="M14.83 8.66l1.5-1.5.1-.63A6.75 6.75 0 005.49 10.4a.81.81 0 01.52-.04l3-.49.24-.24a3.75 3.75 0 015.13-.39z" />
      <path d="M19.43 10.4a6.75 6.75 0 00-2.04-3.27l-2.1 2.1a3.75 3.75 0 011.38 2.97v.37a1.88 1.88 0 010 3.75h-3.75l-.37.38v2.25l.37.37h3.75a4.88 4.88 0 002.76-8.92z" />
      <path d="M9.99 19.88h3.75l.37-.38v-2.25l-.37-.37H9.99a1.86 1.86 0 01-.78-.17l-.53.17-2.1 2.1-.18.55a4.86 4.86 0 003.6 1.35z" />
    </svg>
  ),
};

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
          <line x1="7" y1="17" x2="7.01" y2="17" />
        </svg>
      </span>
    );
  }
  const colors = providerColors[provider];
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
      {PROVIDER_SVG[provider]}
    </span>
  );
};
