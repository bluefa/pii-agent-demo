'use client';

import { useState } from 'react';
import type { CloudProvider } from '@/lib/types';
import { cn } from '@/lib/theme';

const PROVIDER_CONFIG: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  AWS: { label: 'AWS', bg: 'bg-[#FF9900]', text: 'text-[#FF9900]', accent: 'border-[#FF9900]' },
  Azure: { label: 'Azure', bg: 'bg-[#0078D4]', text: 'text-[#0078D4]', accent: 'border-[#0078D4]' },
  GCP: { label: 'GCP', bg: 'bg-[#4285F4]', text: 'text-[#4285F4]', accent: 'border-[#4285F4]' },
  SDU: { label: 'SDU', bg: 'bg-[#6366F1]', text: 'text-[#6366F1]', accent: 'border-[#6366F1]' },
};

interface ProjectSidebarProps {
  cloudProvider: CloudProvider;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export const ProjectSidebar = ({
  cloudProvider,
  children,
  defaultCollapsed = true,
}: ProjectSidebarProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const config = PROVIDER_CONFIG[cloudProvider] ?? PROVIDER_CONFIG.AWS;

  if (collapsed) {
    return (
      <div className="sticky top-6 flex-shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            'group flex flex-col items-center gap-3 px-3 py-5 rounded-xl',
            'bg-white shadow-sm border-l-4',
            'hover:shadow-md transition-all cursor-pointer',
            config.accent,
          )}
        >
          <div className={cn(
            'w-11 h-11 rounded-lg flex items-center justify-center',
            'text-white font-bold text-base shadow-sm',
            config.bg,
          )}>
            {config.label.length <= 3 ? config.label : config.label.charAt(0)}
          </div>
          <span className={cn('text-[11px] font-bold tracking-wide', config.text)}>
            {config.label}
          </span>
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="sticky top-6 w-[320px] flex-shrink-0 space-y-3">
      <button
        onClick={() => setCollapsed(true)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-white shadow-sm border-l-4',
          'hover:shadow-md transition-all cursor-pointer',
          config.accent,
        )}
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          'text-white font-bold text-xs shadow-sm',
          config.bg,
        )}>
          {config.label.length <= 3 ? config.label : config.label.charAt(0)}
        </div>
        <span className={cn('font-semibold text-sm flex-1 text-left', config.text)}>
          {config.label} 프로젝트 정보
        </span>
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      </button>
      {children}
    </div>
  );
};
