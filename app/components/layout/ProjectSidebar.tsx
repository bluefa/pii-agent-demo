import type { CloudProvider } from '@/lib/types';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn } from '@/lib/theme';

const PROVIDER_CONFIG: Record<string, { label: string; accent: string }> = {
  AWS: { label: 'AWS', accent: 'border-[#FF9900]' },
  Azure: { label: 'Azure', accent: 'border-[#0078D4]' },
  GCP: { label: 'GCP', accent: 'border-[#4285F4]' },
  IDC: { label: 'IDC', accent: 'border-gray-400' },
  SDU: { label: 'SDU', accent: 'border-[#6366F1]' },
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
        <span className="font-semibold text-sm text-gray-900">
          {config.label} 프로젝트 정보
        </span>
      </div>
      {children}
    </div>
  );
};
