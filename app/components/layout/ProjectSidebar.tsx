import type { CloudProvider } from '@/lib/types';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, providerColors, textColors } from '@/lib/theme';

const PROVIDER_CONFIG: Record<string, { label: string; accent: string }> = {
  AWS: { label: 'AWS', accent: providerColors.AWS.border },
  Azure: { label: 'Azure', accent: providerColors.Azure.border },
  GCP: { label: 'GCP', accent: providerColors.GCP.border },
  IDC: { label: 'IDC', accent: providerColors.IDC.border },
  SDU: { label: 'SDU', accent: providerColors.SDU.border },
};

interface ProjectSidebarProps {
  cloudProvider: CloudProvider;
  children: React.ReactNode;
}

export const ProjectSidebar = ({
  cloudProvider,
  children,
}: ProjectSidebarProps) => {
  const config = PROVIDER_CONFIG[cloudProvider] ?? PROVIDER_CONFIG.AWS;

  return (
    <div className="w-[320px] flex-shrink-0 overflow-y-auto p-6 space-y-3">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-white shadow-sm border-l-4',
          config.accent,
        )}
      >
        <CloudProviderIcon provider={cloudProvider} size="md" variant="icon" />
        <span className={cn('font-semibold text-sm', textColors.primary)}>
          {config.label} 프로젝트 정보
        </span>
      </div>
      {children}
    </div>
  );
};
