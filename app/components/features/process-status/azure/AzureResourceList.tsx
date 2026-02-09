'use client';

import { useState } from 'react';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { statusColors, cn } from '@/lib/theme';
import type { AzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import type { UnifiedInstallResource, InstallStep } from '@/app/components/features/process-status/azure/AzureInstallationInline';

interface AzureResourceListProps {
  resources: UnifiedInstallResource[];
}

const INITIAL_SHOW_COUNT = 5;

const STEP_SORT_ORDER: Record<InstallStep, number> = {
  SUBNET_REQUIRED: 0,
  VM_TF_REQUIRED: 1,
  PE_REJECTED: 2,
  PE_PENDING: 3,
  PE_NOT_REQUESTED: 4,
  COMPLETED: 5,
};

const STEP_LABELS: Record<InstallStep, string> = {
  SUBNET_REQUIRED: '네트워크 설정 필요',
  VM_TF_REQUIRED: 'VM 환경 설정 필요',
  PE_NOT_REQUESTED: '연결 요청 준비 중',
  PE_PENDING: '연결 승인 대기',
  PE_REJECTED: '연결 거부됨',
  COMPLETED: '완료',
};

const getStepStatusColor = (step: InstallStep) => {
  if (step === 'COMPLETED') return statusColors.success;
  if (step === 'PE_REJECTED') return statusColors.error;
  if (step === 'SUBNET_REQUIRED' || step === 'VM_TF_REQUIRED' || step === 'PE_PENDING') return statusColors.warning;
  return statusColors.pending;
};

const getStepIcon = (step: InstallStep) => {
  if (step === 'COMPLETED') return '\u25CF';
  if (step === 'SUBNET_REQUIRED' || step === 'VM_TF_REQUIRED' || step === 'PE_REJECTED') return '\u26A0';
  if (step === 'PE_PENDING') return '\u25D0';
  return '\u25CB';
};

const sortResources = (resources: UnifiedInstallResource[]) =>
  [...resources].sort((a, b) => STEP_SORT_ORDER[a.step] - STEP_SORT_ORDER[b.step]);

const ResourceGroup = ({ label, resources }: { label: string; resources: UnifiedInstallResource[] }) => {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortResources(resources);
  const hasMore = sorted.length > INITIAL_SHOW_COUNT;
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW_COUNT);

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-1.5">{label} ({resources.length})</div>
      <div className="space-y-1">
        {visible.map(resource => {
          const iconType: AzureResourceType = isAzureResourceType(resource.resourceType)
            ? resource.resourceType as AzureResourceType
            : 'AZURE_MSSQL';
          const color = getStepStatusColor(resource.step);

          return (
            <div key={resource.id} className="flex items-center justify-between py-1.5 px-2 rounded">
              <div className="flex items-center gap-2 min-w-0">
                <AzureServiceIcon type={iconType} size="sm" />
                <span className="text-sm text-gray-900 truncate">{resource.name}</span>
              </div>
              <span className={cn('text-xs font-medium whitespace-nowrap flex items-center gap-1', color.textDark)}>
                {getStepIcon(resource.step)} {STEP_LABELS[resource.step]}
              </span>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? '접기' : `나머지 ${sorted.length - INITIAL_SHOW_COUNT}건 더보기`}
        </button>
      )}
    </div>
  );
};

export const AzureResourceList = ({ resources }: AzureResourceListProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const vmResources = resources.filter(r => r.isVm);
  const dbResources = resources.filter(r => !r.isVm);

  return (
    <div>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors mt-2"
      >
        <span>{isOpen ? '\u25BE' : '\u25B8'}</span>
        리소스별 상태 보기 ({resources.length}건)
      </button>

      {isOpen && (
        <div className={cn('mt-2 p-3 rounded-lg border', statusColors.pending.bg, statusColors.pending.border)}>
          <div className="space-y-3">
            {vmResources.length > 0 && <ResourceGroup label="VM" resources={vmResources} />}
            {dbResources.length > 0 && <ResourceGroup label="DB" resources={dbResources} />}
          </div>
        </div>
      )}
    </div>
  );
};
