'use client';

import React, { useMemo } from 'react';
import { Resource, AwsResourceType } from '@/lib/types';
import { AWS_RESOURCE_TYPE_ORDER } from '@/lib/constants/labels';
import { cn, textColors, bgColors } from '@/lib/theme';
import { ResourceTypeGroup } from './ResourceTypeGroup';
import type { ResourceTableBodyProps } from './types';

const groupByAwsType = (res: Resource[]): [AwsResourceType, Resource[]][] => {
  const groups = new Map<AwsResourceType, Resource[]>();
  res.forEach((resource) => {
    const type = resource.awsType || ('RDS' as AwsResourceType);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(resource);
  });
  return AWS_RESOURCE_TYPE_ORDER.filter(type => groups.has(type))
    .map(type => [type, groups.get(type)!] as [AwsResourceType, Resource[]]);
};

export const AwsResourceTableBody = ({
  resources,
  processStatus,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showCredentialColumn,
  onCheckboxChange,
  colSpan,
  credentials,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: ResourceTableBodyProps) => {
  const grouped = useMemo(() => groupByAwsType(resources), [resources]);

  return (
    <>
      <thead>
        <tr className={cn('text-left text-xs font-medium uppercase tracking-wider', textColors.tertiary, bgColors.muted)}>
          {isEditMode && <th className="px-6 py-3 w-10" />}
          <th className="px-6 py-3">연동 대상 여부</th>
          <th className="px-6 py-3">DB Type</th>
          <th className="px-6 py-3">Resource ID</th>
          <th className="px-6 py-3">Region</th>
          <th className="px-6 py-3">DB Name</th>
          <th className="px-6 py-3">연동 완료 여부</th>
          <th className="px-6 py-3">스캔 이력</th>
          {showCredentialColumn && <th className="px-6 py-3">Credential</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {grouped.map(([resourceType, typeResources]) => (
          <ResourceTypeGroup
            key={resourceType}
            resourceType={resourceType}
            resources={typeResources}
            processStatus={processStatus}
            selectedIds={selectedIds}
            isEditMode={isEditMode}
            isCheckboxEnabled={isCheckboxEnabled}
            showCredentialColumn={showCredentialColumn}
            onCheckboxChange={onCheckboxChange}
            colSpan={colSpan}
            credentials={credentials}
            onCredentialChange={onCredentialChange}
            expandedVmId={expandedVmId}
            onVmConfigToggle={onVmConfigToggle}
            onVmConfigSave={onVmConfigSave}
          />
        ))}
      </tbody>
    </>
  );
};
