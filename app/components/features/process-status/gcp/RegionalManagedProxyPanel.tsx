'use client';

import { GCP_GUIDE_URLS } from '@/lib/constants/gcp';
import { statusColors, cn } from '@/lib/theme';

interface RegionalManagedProxyInfo {
  exists: boolean;
  networkProjectId: string;
  vpcName: string;
  cloudSqlRegion: string;
}

interface RegionalManagedProxyPanelProps {
  proxy: RegionalManagedProxyInfo;
}

export const RegionalManagedProxyPanel = ({
  proxy,
}: RegionalManagedProxyPanelProps) => {
  if (proxy.exists) {
    return (
      <div className={cn('mt-2 p-2 rounded border', statusColors.success.bg, statusColors.success.border)}>
        <div className="flex items-center gap-1.5 mb-1">
          <svg className={cn('w-3.5 h-3.5', statusColors.success.text)} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className={cn('text-xs font-medium', statusColors.success.textDark)}>네트워크 설정 완료</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <span className="text-gray-500">VPC</span>
          <span className="text-gray-700 font-mono">{proxy.vpcName}</span>
          <span className="text-gray-500">리전</span>
          <span className="text-gray-700 font-mono">{proxy.cloudSqlRegion}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mt-2 p-2 rounded border', statusColors.warning.bg, 'border-orange-200')}>
      <div className="flex items-center gap-1.5 mb-1">
        <svg className={cn('w-3.5 h-3.5', statusColors.warning.text)} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>Regional Managed Proxy Subnet 생성이 필요합니다</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-2">
        <span className="text-gray-500">네트워크 프로젝트</span>
        <span className="text-gray-700 font-mono">{proxy.networkProjectId}</span>
        <span className="text-gray-500">VPC</span>
        <span className="text-gray-700 font-mono">{proxy.vpcName}</span>
        <span className="text-gray-500">리전</span>
        <span className="text-gray-700 font-mono">{proxy.cloudSqlRegion}</span>
      </div>
      <p className="text-xs text-gray-600 mb-1.5">서비스 담당자가 GCP Console에서 직접 생성해야 합니다.</p>
      <a
        href={GCP_GUIDE_URLS.SUBNET_CREATION}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
      >
        생성 가이드 보기 →
      </a>
    </div>
  );
};
