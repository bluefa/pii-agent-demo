'use client';

import React from 'react';
import { Resource, DatabaseType, DBCredential, VmDatabaseConfig, AwsResourceType } from '@/lib/types';
import { AWS_RESOURCE_TYPE_LABELS, REGION_LABELS } from '@/lib/constants/labels';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { ResourceRow } from './ResourceRow';
import { statusColors, cn } from '@/lib/theme';

interface ResourceTypeGroupProps {
  resourceType: AwsResourceType;
  resources: Resource[];
  selectedIds: Set<string>;
  isCheckboxEnabled: boolean;
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

const groupByRegion = (resources: Resource[]): Map<string, Resource[]> => {
  const grouped = new Map<string, Resource[]>();
  resources.forEach(resource => {
    const region = resource.region || 'unknown';
    if (!grouped.has(region)) grouped.set(region, []);
    grouped.get(region)!.push(resource);
  });
  return grouped;
};

const RegionIcon = () => (
  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

export const ResourceTypeGroup = ({
  resourceType,
  resources,
  selectedIds,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  getCredentialsForType,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: ResourceTypeGroupProps) => {
  const regionGroups = groupByRegion(resources);
  const hasMultipleRegions = regionGroups.size > 1;

  return (
    <>
      {/* Resource Type Header */}
      <tr className="bg-gradient-to-r from-slate-100 to-transparent">
        <td colSpan={colSpan} className="px-6 py-3">
          <div className="flex items-center gap-2">
            <AwsServiceIcon type={resourceType} size="lg" />
            <span className="text-base font-bold text-slate-800">
              {AWS_RESOURCE_TYPE_LABELS[resourceType]}
            </span>
            <span className="text-sm text-slate-500">({resources.length})</span>
          </div>
        </td>
      </tr>

      {/* EC2 안내 배너 */}
      {resourceType === 'EC2' && (
        <tr>
          <td colSpan={colSpan} className="px-6 py-2">
            <div className={cn(
              statusColors.info.bg,
              statusColors.info.border,
              'border-l-4 px-4 py-3 rounded'
            )}>
              <p className={cn(statusColors.info.textDark, 'text-sm')}>
                DB 운영 목적으로 사용하는 EC2만 연동 대상입니다. 연동이 필요하지 않으면 선택하지 않아도 됩니다.
              </p>
            </div>
          </td>
        </tr>
      )}

      {/* Region Subgroups */}
      {Array.from(regionGroups.entries())
        .sort(([a], [b]) => {
          if (a === 'ap-northeast-2') return -1;
          if (b === 'ap-northeast-2') return 1;
          return a.localeCompare(b);
        })
        .map(([region, regionResources]) => (
          <React.Fragment key={region}>
            {hasMultipleRegions && (
              <tr className="bg-slate-50/50">
                <td colSpan={colSpan} className="px-8 py-2">
                  <div className="flex items-center gap-2">
                    <RegionIcon />
                    <span className="text-sm font-medium text-slate-600">
                      {REGION_LABELS[region] || region}
                    </span>
                    <span className="text-xs text-slate-400">({regionResources.length})</span>
                  </div>
                </td>
              </tr>
            )}
            {regionResources.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                isAWS={true}
                cloudProvider="AWS"
                selectedIds={selectedIds}
                isCheckboxEnabled={isCheckboxEnabled}
                showConnectionStatus={showConnectionStatus}
                showCredentialColumn={showCredentialColumn}
                onCheckboxChange={onCheckboxChange}
                getCredentialsForType={getCredentialsForType}
                onCredentialChange={onCredentialChange}
                expandedVmId={expandedVmId}
                onVmConfigToggle={onVmConfigToggle}
                onVmConfigSave={onVmConfigSave}
              />
            ))}
          </React.Fragment>
        ))}
    </>
  );
};
