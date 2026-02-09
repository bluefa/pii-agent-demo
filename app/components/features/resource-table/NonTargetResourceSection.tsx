'use client';

import React, { useState } from 'react';
import { ResourceTypeGroup } from './ResourceTypeGroup';
import { cn, textColors, statusColors, bgColors } from '@/lib/theme';
import { isPeIneligible } from '@/lib/types';
import type { Resource, DatabaseType, DBCredential, AwsResourceType, VmDatabaseConfig } from '@/lib/types';

interface NonTargetResourceSectionProps {
  resources: Resource[];
  label?: string;
  isEditMode: boolean;
  selectedIds: Set<string>;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

const groupByResourceType = (resources: Resource[]): Map<AwsResourceType, Resource[]> => {
  const grouped = new Map<AwsResourceType, Resource[]>();
  resources.forEach(resource => {
    const type = (resource.awsType || resource.type) as AwsResourceType;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(resource);
  });
  return grouped;
};

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-90')}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
);

const WarningIcon = () => (
  <svg className={cn('w-4 h-4', statusColors.warning.text)} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

interface CollapsibleResourceGroupProps {
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  labelClassName?: string;
  contentClassName?: string;
  typeGroups: Map<AwsResourceType, Resource[]>;
  isEditMode: boolean;
  selectedIds: Set<string>;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

const CollapsibleResourceGroup = ({
  isOpen,
  onToggle,
  label,
  count,
  icon,
  labelClassName,
  contentClassName,
  typeGroups,
  isEditMode,
  selectedIds,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  getCredentialsForType,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: CollapsibleResourceGroupProps) => (
  <div className="mt-4">
    <button
      onClick={onToggle}
      className={cn('flex items-center gap-2 px-6 py-3 w-full text-left transition-colors rounded-lg', `hover:${bgColors.muted}`)}
    >
      <ChevronIcon isOpen={isOpen} />
      {icon}
      <span className={cn('text-sm font-semibold', labelClassName || textColors.secondary)}>
        {label}
      </span>
      <span className={cn('text-sm', textColors.tertiary)}>
        ({count})
      </span>
    </button>

    {isOpen && (
      <div className={contentClassName}>
        <table className="w-full">
          <tbody>
            {Array.from(typeGroups.entries()).map(([type, typeResources]) => (
              <ResourceTypeGroup
                key={type}
                resourceType={type}
                resources={typeResources}
                selectedIds={selectedIds}
                isEditMode={isEditMode}
                isCheckboxEnabled={isEditMode}
                showConnectionStatus={showConnectionStatus}
                showCredentialColumn={showCredentialColumn}
                onCheckboxChange={onCheckboxChange}
                colSpan={colSpan}
                getCredentialsForType={getCredentialsForType}
                onCredentialChange={onCredentialChange}
                expandedVmId={expandedVmId}
                onVmConfigToggle={onVmConfigToggle}
                onVmConfigSave={onVmConfigSave}
              />
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export const NonTargetResourceSection = ({
  resources,
  label = '연동 제외 리소스',
  isEditMode,
  selectedIds,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  getCredentialsForType,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: NonTargetResourceSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVnetOpen, setIsVnetOpen] = useState(true);
  const nonTargetResources = resources.filter(r => !r.isSelected);

  if (nonTargetResources.length === 0) return null;

  const vnetResources = nonTargetResources.filter(r => isPeIneligible(r));
  const normalNonTargetResources = nonTargetResources.filter(r => !isPeIneligible(r));

  const sharedProps = {
    isEditMode,
    selectedIds,
    showConnectionStatus,
    showCredentialColumn,
    onCheckboxChange,
    colSpan,
    getCredentialsForType,
    onCredentialChange,
    expandedVmId,
    onVmConfigToggle,
    onVmConfigSave,
  };

  return (
    <>
      {vnetResources.length > 0 && (
        <CollapsibleResourceGroup
          isOpen={isVnetOpen}
          onToggle={() => setIsVnetOpen(prev => !prev)}
          label="PE 연결 불가 (VNet Integration)"
          count={vnetResources.length}
          icon={<WarningIcon />}
          labelClassName={statusColors.warning.textDark}
          contentClassName={cn('rounded-lg', statusColors.warning.bg)}
          typeGroups={groupByResourceType(vnetResources)}
          {...sharedProps}
        />
      )}

      {normalNonTargetResources.length > 0 && (
        <CollapsibleResourceGroup
          isOpen={isOpen}
          onToggle={() => setIsOpen(prev => !prev)}
          label={label}
          count={normalNonTargetResources.length}
          contentClassName="opacity-60"
          typeGroups={groupByResourceType(normalNonTargetResources)}
          {...sharedProps}
        />
      )}
    </>
  );
};
