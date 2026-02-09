'use client';

import React, { useState, useMemo } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  DatabaseType,
  AwsResourceType,
  DBCredential,
  VmDatabaseConfig,
} from '@/lib/types';
import { filterCredentialsByType } from '@/lib/utils/credentials';
import { AWS_RESOURCE_TYPE_ORDER } from '@/lib/constants/labels';
import { cn, statusColors, textColors, badgeStyles, getButtonClass, bgColors } from '@/lib/theme';
import {
  ResourceRow,
  ResourceTypeGroup,
  EmptyState,
  NonTargetResourceSection,
} from './resource-table';

interface ResourceTableProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
  onEditModeChange?: (isEdit: boolean) => void;
}

const ConnectionBadge = ({ label, count, variant }: { label: string; count: number; variant: 'success' | 'error' | 'pending' }) => {
  const colors = statusColors[variant];
  return (
    <span className={cn(badgeStyles.base, badgeStyles.sizes.sm, colors.bg, colors.textDark)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {label} {count}
    </span>
  );
};

export const ResourceTable = ({
  resources,
  cloudProvider,
  processStatus,
  isEditMode: externalEditMode = false,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  credentials = [],
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
  onEditModeChange,
}: ResourceTableProps) => {
  const [internalEditMode, setInternalEditMode] = useState(false);

  const selectedIdsSet = new Set(
    externalSelectedIds ?? resources.filter((r) => r.isSelected).map((r) => r.id)
  );

  const isAWS = cloudProvider === 'AWS';
  const isEditMode = externalEditMode || internalEditMode;
  const isCheckboxEnabled =
    processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION || isEditMode;
  const showConnectionStatus =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const targetResources = resources.filter((r) => r.isSelected || selectedIdsSet.has(r.id));

  const connectedCount = targetResources.filter((r) => r.connectionStatus === 'CONNECTED').length;
  const disconnectedCount = targetResources.filter((r) => r.connectionStatus === 'DISCONNECTED').length;
  const pendingCount = targetResources.filter((r) => !r.connectionStatus || r.connectionStatus === 'PENDING').length;

  const groupByAwsType = (res: Resource[]) => {
    const groups = new Map<AwsResourceType, Resource[]>();
    res.forEach((resource) => {
      const type = resource.awsType || ('RDS' as AwsResourceType);
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(resource);
    });
    return AWS_RESOURCE_TYPE_ORDER.filter(type => groups.has(type))
      .map(type => [type, groups.get(type)!] as [AwsResourceType, Resource[]]);
  };

  const groupedByType = useMemo(() => isAWS ? groupByAwsType(targetResources) : null, [targetResources, isAWS]);
  const allGroupedByType = useMemo(() => isAWS ? groupByAwsType(resources) : null, [resources, isAWS]);

  const handleCheckboxChange = (resourceId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIdsSet);
    if (checked) {
      newSelectedIds.add(resourceId);
    } else {
      newSelectedIds.delete(resourceId);
    }
    onSelectionChange?.(Array.from(newSelectedIds));
  };

  const colSpan = (isAWS ? 3 : 4) + (isEditMode ? 1 : 0) + (showCredentialColumn ? 1 : 0) + (showConnectionStatus ? 1 : 0);

  const getCredentialsForType = (databaseType: DatabaseType): DBCredential[] =>
    filterCredentialsByType(credentials, databaseType);

  const handleToggleEditMode = () => {
    const next = !internalEditMode;
    setInternalEditMode(next);
    onEditModeChange?.(next);
  };

  const displayResources = isEditMode ? resources : targetResources;
  const displayGrouped = isEditMode ? allGroupedByType : groupedByType;

  const renderTable = (res: Resource[], grouped: [AwsResourceType, Resource[]][] | null) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className={cn('text-left text-xs font-medium uppercase tracking-wider', textColors.tertiary, bgColors.muted)}>
            {isEditMode && <th className="px-6 py-3 w-12" />}
            {!isAWS && <th className="px-6 py-3">인스턴스 타입</th>}
            <th className="px-6 py-3">데이터베이스</th>
            <th className="px-6 py-3">리소스 ID</th>
            {showCredentialColumn && <th className="px-6 py-3">Credential</th>}
            {showConnectionStatus && <th className="px-6 py-3">연결 상태</th>}
            <th className="px-6 py-3 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isAWS && grouped ? (
            grouped.map(([resourceType, typeResources]) => (
              <ResourceTypeGroup
                key={resourceType}
                resourceType={resourceType}
                resources={typeResources}
                selectedIds={selectedIdsSet}
                isEditMode={isEditMode}
                isCheckboxEnabled={isCheckboxEnabled}
                showConnectionStatus={showConnectionStatus}
                showCredentialColumn={showCredentialColumn}
                onCheckboxChange={handleCheckboxChange}
                colSpan={colSpan}
                getCredentialsForType={getCredentialsForType}
                onCredentialChange={onCredentialChange}
                expandedVmId={expandedVmId}
                onVmConfigToggle={onVmConfigToggle}
                onVmConfigSave={onVmConfigSave}
              />
            ))
          ) : (
            res.map((resource) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                isAWS={false}
                cloudProvider={cloudProvider}
                selectedIds={selectedIdsSet}
                isEditMode={isEditMode}
                isCheckboxEnabled={isCheckboxEnabled}
                showConnectionStatus={showConnectionStatus}
                showCredentialColumn={showCredentialColumn}
                onCheckboxChange={handleCheckboxChange}
                getCredentialsForType={getCredentialsForType}
                onCredentialChange={onCredentialChange}
                expandedVmId={expandedVmId}
                onVmConfigToggle={onVmConfigToggle}
                onVmConfigSave={onVmConfigSave}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      {/* Header Bar */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', textColors.primary)}>
            {isEditMode ? '전체 리소스' : '연동 대상'}
          </span>
          <span className={cn(badgeStyles.base, badgeStyles.sizes.sm, statusColors.info.bg, statusColors.info.textDark)}>
            {isEditMode ? `${selectedIdsSet.size}/${resources.length} 선택` : targetResources.length}
          </span>
          {!isEditMode && showConnectionStatus && (
            <>
              {connectedCount > 0 && <ConnectionBadge label="연결" count={connectedCount} variant="success" />}
              {disconnectedCount > 0 && <ConnectionBadge label="끊김" count={disconnectedCount} variant="error" />}
              {pendingCount > 0 && <ConnectionBadge label="대기" count={pendingCount} variant="pending" />}
            </>
          )}
        </div>
        {!externalEditMode && targetResources.length > 0 && (
          <button
            onClick={handleToggleEditMode}
            className={getButtonClass(internalEditMode ? 'secondary' : 'ghost', 'sm')}
          >
            {internalEditMode ? '수정 완료' : '대상 수정'}
          </button>
        )}
      </div>

      {/* Edit mode: single unified list */}
      {isEditMode ? (
        displayResources.length > 0 ? renderTable(displayResources, displayGrouped) : (
          <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
            발견된 리소스가 없습니다
          </div>
        )
      ) : (
        <>
          {/* Monitor mode: target resources */}
          {targetResources.length === 0 ? (
            <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
              아직 연동 대상이 선택되지 않았습니다
            </div>
          ) : renderTable(targetResources, groupedByType)}

          {/* Monitor mode: non-target resources */}
          <NonTargetResourceSection
            resources={resources}
            label={targetResources.length === 0 ? '발견된 리소스' : '연동 제외 리소스'}
            isEditMode={false}
            selectedIds={selectedIdsSet}
            showConnectionStatus={showConnectionStatus}
            showCredentialColumn={showCredentialColumn}
            onCheckboxChange={handleCheckboxChange}
            colSpan={colSpan}
            getCredentialsForType={getCredentialsForType}
            onCredentialChange={onCredentialChange}
            expandedVmId={expandedVmId}
            onVmConfigToggle={onVmConfigToggle}
            onVmConfigSave={onVmConfigSave}
          />
        </>
      )}
    </div>
  );
};
