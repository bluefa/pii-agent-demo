'use client';

import { statusColors, cn } from '@/lib/theme';

interface InstallationLoadingViewProps {
  provider: string;
}

export const InstallationLoadingView = ({ provider }: InstallationLoadingViewProps) => (
  <div className={cn('w-full px-4 py-3 rounded-lg border', statusColors.pending.bg, statusColors.pending.border)}>
    <div className="flex items-center gap-3">
      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      <span className={cn('text-sm', statusColors.pending.textDark)}>{provider} 설치 상태 확인 중...</span>
    </div>
  </div>
);
