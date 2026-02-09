'use client';

import React, { useState } from 'react';
import { Resource, DatabaseType, DBCredential, VmDatabaseConfig, AwsResourceType } from '@/lib/types';
import { AWS_RESOURCE_TYPE_LABELS, REGION_LABELS } from '@/lib/constants/labels';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { ResourceRow } from './ResourceRow';
import { ClusterRow } from './ClusterRow';
import { statusColors, cn, providerColors, textColors, bgColors } from '@/lib/theme';

const COLLAPSE_THRESHOLD = 5;

interface ResourceTypeGroupProps {
  resourceType: AwsResourceType;
  resources: Resource[];
  selectedIds: Set<string>;
  isEditMode: boolean;
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
  <svg className={cn('w-3.5 h-3.5', textColors.quaternary)} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

export const ResourceTypeGroup = ({
  resourceType,
  resources,
  selectedIds,
  isEditMode,
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
  const [isExpanded, setIsExpanded] = useState(false);
  const regionGroups = groupByRegion(resources);
  const hasMultipleRegions = regionGroups.size > 1;
  const needsCollapse = resources.length > COLLAPSE_THRESHOLD;
  const hiddenCount = resources.length - COLLAPSE_THRESHOLD;

  const allResources = Array.from(regionGroups.entries())
    .sort(([a], [b]) => {
      if (a === 'ap-northeast-2') return -1;
      if (b === 'ap-northeast-2') return 1;
      return a.localeCompare(b);
    });

  const visibleResources = (() => {
    if (!needsCollapse || isExpanded) return allResources;
    let remaining = COLLAPSE_THRESHOLD;
    const result: [string, Resource[]][] = [];
    for (const [region, regionRes] of allResources) {
      if (remaining <= 0) break;
      if (regionRes.length <= remaining) {
        result.push([region, regionRes]);
        remaining -= regionRes.length;
      } else {
        result.push([region, regionRes.slice(0, remaining)]);
        remaining = 0;
      }
    }
    return result;
  })();

  return (
    <>
      {/* Resource Type Header */}
      <tr className={cn('border-l-4', providerColors.AWS.border)}>
        <td colSpan={colSpan} className="px-6 py-3">
          <div className="flex items-center gap-2">
            <AwsServiceIcon type={resourceType} size="lg" />
            <span className={cn('text-base font-bold', textColors.primary)}>
              {AWS_RESOURCE_TYPE_LABELS[resourceType]}
            </span>
            <span className={cn('text-sm', textColors.tertiary)}>({resources.length})</span>
          </div>
        </td>
      </tr>

      {/* EC2 안내 배너 -- 선택 모드(전체 탭)에서만 표시 */}
      {resourceType === 'EC2' && isCheckboxEnabled && (
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
      {visibleResources.map(([region, regionResources]) => (
        <React.Fragment key={region}>
          {hasMultipleRegions && (
            <tr className={bgColors.muted}>
              <td colSpan={colSpan} className="px-8 py-2">
                <div className="flex items-center gap-2">
                  <RegionIcon />
                  <span className={cn('text-sm font-medium', textColors.secondary)}>
                    {REGION_LABELS[region] || region}
                  </span>
                  <span className={cn('text-xs', textColors.quaternary)}>({regionResources.length})</span>
                </div>
              </td>
            </tr>
          )}
          {regionResources.map((resource) => (
            resource.awsType === 'RDS_CLUSTER' ? (
              <ClusterRow
                key={resource.id}
                resource={resource}
                selectedIds={selectedIds}
                isEditMode={isEditMode}
                isCheckboxEnabled={isCheckboxEnabled}
                showConnectionStatus={showConnectionStatus}
                onCheckboxChange={onCheckboxChange}
              />
            ) : (
              <ResourceRow
                key={resource.id}
                resource={resource}
                isAWS={true}
                cloudProvider="AWS"
                selectedIds={selectedIds}
                isEditMode={isEditMode}
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
            )
          ))}
        </React.Fragment>
      ))}

      {/* Expand / Collapse toggle */}
      {needsCollapse && (
        <tr>
          <td colSpan={colSpan} className="px-6 py-2">
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className={cn(
                'text-sm font-medium transition-colors',
                statusColors.info.textDark,
                'hover:underline'
              )}
            >
              {isExpanded ? '접기' : `+${hiddenCount}개 더보기`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
};
