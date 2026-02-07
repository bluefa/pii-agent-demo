'use client';

import { useState } from 'react';
import { createGcpProxySubnet } from '@/app/lib/api/gcp';
import { GCP_GUIDE_URLS } from '@/lib/constants/gcp';
import { statusColors, cn } from '@/lib/theme';
import type { GcpRegionalManagedProxyStatus } from '@/lib/types/gcp';

interface RegionalManagedProxyPanelProps {
  projectId: string;
  resourceId: string;
  proxy: GcpRegionalManagedProxyStatus;
  onSubnetCreated?: () => void;
}

export const RegionalManagedProxyPanel = ({
  projectId,
  resourceId,
  proxy,
  onSubnetCreated,
}: RegionalManagedProxyPanelProps) => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSubnet = async () => {
    try {
      setCreating(true);
      setError(null);
      await createGcpProxySubnet(projectId, resourceId);
      onSubnetCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subnet 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  if (proxy.exists) {
    return (
      <div className={cn('mt-2 p-2 rounded border', statusColors.success.bg, statusColors.success.border)}>
        <div className="flex items-center gap-1.5 mb-1">
          <svg className={cn('w-3.5 h-3.5', statusColors.success.text)} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className={cn('text-xs font-medium', statusColors.success.textDark)}>Regional Managed Proxy Subnet 확인됨</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <span className="text-gray-500">VPC</span>
          <span className="text-gray-700 font-mono">{proxy.vpcName}</span>
          <span className="text-gray-500">Region</span>
          <span className="text-gray-700 font-mono">{proxy.cloudSqlRegion}</span>
          {proxy.subnetName && (
            <>
              <span className="text-gray-500">Subnet</span>
              <span className="text-gray-700 font-mono">{proxy.subnetName}</span>
            </>
          )}
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
        <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>Regional Managed Proxy Subnet 필요</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mb-2">
        <span className="text-gray-500">Network Project</span>
        <span className="text-gray-700 font-mono">{proxy.networkProjectId}</span>
        <span className="text-gray-500">VPC</span>
        <span className="text-gray-700 font-mono">{proxy.vpcName}</span>
        <span className="text-gray-500">Region</span>
        <span className="text-gray-700 font-mono">{proxy.cloudSqlRegion}</span>
      </div>
      {error && (
        <p className={cn('text-xs mb-1.5', statusColors.error.textDark)}>{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCreateSubnet}
          disabled={creating}
          className={cn(
            'px-2 py-1 text-xs font-medium rounded transition-colors',
            statusColors.warning.bg, statusColors.warning.textDark,
            'border border-orange-300 hover:border-orange-400',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {creating ? '생성 중...' : 'Subnet 자동 생성'}
        </button>
        <a
          href={GCP_GUIDE_URLS.SUBNET_CREATION}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          가이드 보기 →
        </a>
      </div>
    </div>
  );
};
