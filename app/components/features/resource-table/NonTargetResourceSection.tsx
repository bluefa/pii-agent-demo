'use client';

import { useState } from 'react';
import { ResourceTypeGroup } from './ResourceTypeGroup';
import { cn, textColors } from '@/lib/theme';
import type { Resource, DatabaseType, DBCredential, AwsResourceType, VmDatabaseConfig } from '@/lib/types';

interface NonTargetResourceSectionProps {
  resources: Resource[];
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

export const NonTargetResourceSection = ({
  resources,
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
  const nonTargetResources = resources.filter(r => !r.isSelected);

  if (nonTargetResources.length === 0) return null;

  const typeGroups = groupByResourceType(nonTargetResources);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-6 py-3 w-full text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <ChevronIcon isOpen={isOpen} />
        <span className={cn('text-sm font-semibold', textColors.secondary)}>
          비연동 리소스
        </span>
        <span className={cn('text-sm', textColors.tertiary)}>
          ({nonTargetResources.length})
        </span>
      </button>

      {isOpen && (
        <div className="opacity-60">
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
};
