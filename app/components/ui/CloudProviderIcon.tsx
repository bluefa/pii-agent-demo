import { CloudProvider } from '@/lib/types';

interface CloudProviderIconProps {
  provider: CloudProvider;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'icon' | 'badge';
}

const sizeMap = {
  sm: { icon: 'w-4 h-4', badge: 'px-2 py-0.5 text-xs', container: 'w-8 h-8' },
  md: { icon: 'w-5 h-5', badge: 'px-2.5 py-1 text-sm', container: 'w-10 h-10' },
  lg: { icon: 'w-7 h-7', badge: 'px-3 py-1.5 text-sm', container: 'w-12 h-12' },
};

const providerConfig: Record<CloudProvider, { bg: string; text: string; label: string }> = {
  AWS: { bg: 'bg-[#FF9900]/10', text: 'text-[#FF9900]', label: 'AWS' },
  Azure: { bg: 'bg-[#0078D4]/10', text: 'text-[#0078D4]', label: 'Azure' },
  GCP: { bg: 'bg-[#4285F4]/10', text: 'text-[#4285F4]', label: 'GCP' },
  IDC: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'IDC' },
  SDU: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'SDU' },
};

const AwsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.64 11.18c0 .26.03.47.07.63.05.16.11.33.2.51.03.05.04.1.04.14 0 .06-.04.12-.11.18l-.37.25a.29.29 0 01-.15.05c-.06 0-.12-.03-.17-.08a1.76 1.76 0 01-.21-.27 4.4 4.4 0 01-.18-.34c-.46.54-1.03.81-1.73.81-.49 0-.89-.14-1.18-.42-.3-.28-.44-.65-.44-1.12 0-.5.17-.9.53-1.2.35-.31.82-.46 1.42-.46.2 0 .4.02.61.05.21.03.43.08.66.13v-.43c0-.44-.1-.75-.28-.93-.18-.17-.49-.26-.92-.26-.2 0-.4.02-.61.07-.21.05-.41.11-.61.18a1.55 1.55 0 01-.19.06c-.03.01-.06.01-.08.01-.07 0-.11-.05-.11-.16v-.26c0-.08.01-.15.04-.19.02-.04.07-.08.14-.12.2-.1.43-.19.72-.26.28-.07.58-.1.9-.1.69 0 1.19.16 1.52.47.32.31.48.79.48 1.43v1.89zm-2.39.89c.19 0 .39-.04.59-.1.2-.07.38-.19.53-.36.09-.1.16-.22.2-.36.04-.14.06-.3.06-.5v-.24a4.79 4.79 0 00-1.04-.13c-.37 0-.64.07-.82.22-.18.14-.27.35-.27.62 0 .25.07.45.2.58.13.13.33.2.57.2l-.02.07zm4.72.6c-.1 0-.16-.02-.2-.05-.04-.03-.08-.1-.11-.2l-1.27-4.17c-.03-.1-.05-.17-.05-.2 0-.08.04-.13.13-.13h.51c.1 0 .17.02.2.05.04.04.07.1.11.2l.9 3.57.84-3.57c.03-.1.06-.17.1-.2.04-.04.11-.05.21-.05h.42c.1 0 .16.02.2.05.04.04.08.1.11.2l.85 3.62.93-3.62c.04-.1.08-.17.11-.2.04-.04.11-.05.2-.05h.49c.09 0 .13.04.13.13 0 .03 0 .06-.01.1-.01.04-.02.09-.04.15l-1.3 4.17c-.03.1-.07.17-.11.2-.04.04-.11.05-.2.05h-.45c-.1 0-.16-.02-.2-.05-.04-.04-.08-.1-.1-.21l-.84-3.48-.83 3.48c-.03.1-.06.17-.1.21-.04.03-.11.05-.2.05h-.45zm7.54.15c-.3 0-.6-.04-.88-.1-.28-.07-.5-.14-.64-.21-.09-.05-.15-.1-.17-.15a.38.38 0 01-.03-.15v-.27c0-.11.04-.16.12-.16.03 0 .06 0 .09.02l.13.05c.18.08.38.14.59.18.22.05.42.07.64.07.34 0 .6-.06.8-.18.19-.12.28-.3.28-.52 0-.15-.05-.28-.15-.38-.1-.1-.3-.2-.57-.29l-.82-.26c-.41-.13-.72-.32-.91-.58a1.37 1.37 0 01-.29-.85c0-.25.05-.46.16-.66.1-.19.25-.36.43-.49.18-.14.39-.24.62-.31.24-.07.49-.1.76-.1.13 0 .27 0 .4.02l.4.06c.12.03.23.06.33.09.1.03.19.07.25.1.09.05.15.1.18.14.03.05.05.11.05.2v.24c0 .11-.04.16-.12.16-.04 0-.11-.02-.2-.06-.3-.14-.63-.2-1-.2-.3 0-.55.05-.73.16-.17.1-.26.26-.26.48 0 .16.06.29.17.39.11.1.32.2.62.3l.8.25c.41.13.7.31.89.55.18.23.27.5.27.79 0 .25-.05.48-.16.68-.1.2-.26.38-.44.53-.19.15-.42.26-.69.34-.27.08-.58.12-.9.12z"/>
    <path d="M21.73 16.79c-2.04 1.5-5 2.3-7.54 2.3-3.57 0-6.78-1.32-9.21-3.51-.19-.17-.02-.4.21-.27 2.62 1.53 5.87 2.45 9.22 2.45 2.26 0 4.75-.47 7.04-1.44.34-.15.63.23.28.47z"/>
    <path d="M22.54 15.86c-.26-.33-1.73-.16-2.39-.08-.2.02-.23-.15-.05-.28 1.17-.82 3.09-.58 3.31-.31.23.28-.06 2.2-1.16 3.12-.17.14-.33.07-.25-.12.25-.61.8-1.99.54-2.33z"/>
  </svg>
);

const AzureIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.39 4h5.32l-5.47 15.8a.62.62 0 01-.59.42H4.42a.62.62 0 01-.58-.83L8.8 4.42A.62.62 0 019.39 4z"/>
    <path d="M17.87 14.66H9.1a.29.29 0 00-.2.5l5.58 5.03a.62.62 0 00.42.16h4.69l-1.72-5.69z" opacity=".7"/>
    <path d="M9.39 4a.61.61 0 00-.59.45L3.84 19.36a.62.62 0 00.58.84h4.37a.62.62 0 00.47-.28l1.36-2.1 3.98 3.59a.63.63 0 00.41.15h4.67l-1.98-6.54-6.85.01 4.69-10.6H9.39z"/>
  </svg>
);

const GcpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.19 5h-.38l-2.64 2.64.11.37a5.63 5.63 0 012.53-.6 5.65 5.65 0 015.05 3.1l.37.11L19.87 8A8.28 8.28 0 0012.19 5z" fill="#EA4335"/>
    <path d="M5 12.19c0 1.73.54 3.34 1.46 4.66l2.64-2.64a5.64 5.64 0 01-.6-2.53c0-.87.2-1.7.55-2.44l-.1-.37L6.32 6.23A8.23 8.23 0 005 12.19z" fill="#4285F4"/>
    <path d="M12.19 17.5c1.42 0 2.73-.46 3.8-1.23l-2.64-2.64a5.42 5.42 0 01-1.16.14 5.63 5.63 0 01-5.05-3.1l-.37-.11L4.13 13.2a8.28 8.28 0 008.06 4.3z" fill="#34A853"/>
    <path d="M19.87 8l-2.64 2.64a5.64 5.64 0 01.55 2.44 5.63 5.63 0 01-3.1 5.05l-.11.37 2.64 2.64A8.28 8.28 0 0019.87 8z" fill="#FBBC05"/>
  </svg>
);

const IdcIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const SduIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const IconMap: Record<CloudProvider, React.FC<{ className?: string }>> = {
  AWS: AwsIcon,
  Azure: AzureIcon,
  GCP: GcpIcon,
  IDC: IdcIcon,
  SDU: SduIcon,
};

export { AwsIcon, AzureIcon, GcpIcon, IdcIcon, SduIcon };

export const CloudProviderIcon = ({
  provider,
  size = 'md',
  showLabel = true,
  variant = 'badge',
}: CloudProviderIconProps) => {
  const config = providerConfig[provider];
  const sizes = sizeMap[size];
  const Icon = IconMap[provider];

  if (variant === 'icon') {
    return (
      <div className={`${sizes.container} ${config.bg} rounded-lg flex items-center justify-center`}>
        <Icon className={`${sizes.icon} ${config.text}`} />
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizes.badge} rounded-lg ${config.bg} ${config.text} font-medium`}>
      <Icon className={sizes.icon} />
      {showLabel && config.label}
    </span>
  );
};
