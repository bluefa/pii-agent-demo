'use client';

import React, { useMemo, useState } from 'react';
import { Resource, CloudProvider, SecretKey, VmDatabaseConfig } from '@/lib/types';
import type { ResourceType } from '@/lib/types';
import { getResourceTypeLabel, RESOURCE_TYPE_ORDER_BY_PROVIDER } from '@/lib/constants/labels';
import { ServiceIcon } from '@/app/components/ui/ServiceIcon';
import { cn, textColors, bgColors, providerColors, statusColors } from '@/lib/theme';
import { ResourceRow } from './ResourceRow';

const COLLAPSE_THRESHOLD = 5;

interface ResourceTableBodyProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  colSpan: number;
  credentials: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

const groupByResourceType = (res: Resource[], provider: CloudProvider): [ResourceType, Resource[]][] => {
  const groups = new Map<ResourceType, Resource[]>();
  res.forEach((resource) => {
    const type = resource.type as ResourceType;
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(resource);
  });
  const order = RESOURCE_TYPE_ORDER_BY_PROVIDER[provider];
  if (!order) return Array.from(groups.entries());
  return order
    .filter(type => groups.has(type))
    .map(type => [type, groups.get(type)!] as [ResourceType, Resource[]]);
};

interface TypeGroupProps {
  cloudProvider: CloudProvider;
  resourceType: ResourceType;
  resources: Resource[];
  colSpan: number;
  rowProps: Omit<ResourceTableBodyProps, 'resources' | 'colSpan'>;
}

const TypeGroup = ({ cloudProvider, resourceType, resources, colSpan, rowProps }: TypeGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsCollapse = resources.length > COLLAPSE_THRESHOLD;
  const hiddenCount = resources.length - COLLAPSE_THRESHOLD;
  const visibleResources = needsCollapse && !isExpanded
    ? resources.slice(0, COLLAPSE_THRESHOLD)
    : resources;

  return (
    <>
      <tr className={cn('border-l-4', providerColors[cloudProvider].border)}>
        <td colSpan={colSpan} className="px-6 py-3">
          <div className="flex items-center gap-2">
            <ServiceIcon provider={cloudProvider} resourceType={resourceType} size="lg" />
            <span className={cn('text-base font-bold', textColors.primary)}>
              {getResourceTypeLabel(resourceType)}
            </span>
            <span className={cn('text-sm', textColors.tertiary)}>({resources.length})</span>
          </div>
        </td>
      </tr>
      {visibleResources.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          cloudProvider={cloudProvider}
          hideTypeColumn
          selectedIds={rowProps.selectedIds}
          isEditMode={rowProps.isEditMode}
          isCheckboxEnabled={rowProps.isCheckboxEnabled}
          showConnectionStatus={rowProps.showConnectionStatus}
          showCredentialColumn={rowProps.showCredentialColumn}
          onCheckboxChange={rowProps.onCheckboxChange}
          credentials={rowProps.credentials}
          onCredentialChange={rowProps.onCredentialChange}
          expandedVmId={rowProps.expandedVmId}
          onVmConfigToggle={rowProps.onVmConfigToggle}
          onVmConfigSave={rowProps.onVmConfigSave}
        />
      ))}
      {needsCollapse && (
        <tr>
          <td colSpan={colSpan} className="px-6 py-2">
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className={cn('text-sm font-medium transition-colors', statusColors.info.textDark, 'hover:underline')}
            >
              {isExpanded ? '접기' : `+${hiddenCount}개 더보기`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
};

export const GroupedResourceTableBody = (props: ResourceTableBodyProps) => {
  const { resources, cloudProvider, colSpan, isEditMode, showCredentialColumn, showConnectionStatus } = props;
  const grouped = useMemo(
    () => groupByResourceType(resources, cloudProvider),
    [resources, cloudProvider]
  );

  return (
    <>
      <thead>
        <tr className={cn('text-left text-xs font-medium uppercase tracking-wider', textColors.tertiary, bgColors.muted)}>
          {isEditMode && <th className="px-6 py-3 w-12" />}
          <th className="px-6 py-3">리소스 ID</th>
          <th className="px-6 py-3">데이터베이스</th>
          {showCredentialColumn && <th className="px-6 py-3">Credential</th>}
          {showConnectionStatus && <th className="px-6 py-3">연결 상태</th>}
          <th className="px-6 py-3 w-16" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {grouped.map(([resourceType, typeResources]) => (
          <TypeGroup
            key={resourceType}
            cloudProvider={cloudProvider}
            resourceType={resourceType}
            resources={typeResources}
            colSpan={colSpan}
            rowProps={props}
          />
        ))}
      </tbody>
    </>
  );
};
