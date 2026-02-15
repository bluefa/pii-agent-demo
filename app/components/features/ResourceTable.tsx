'use client';

import React, { useState } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  DatabaseType,
  SecretKey,
  VmDatabaseConfig,
} from '@/lib/types';
import { filterCredentialsByType } from '@/lib/utils/credentials';
import { cn, statusColors, textColors, badgeStyles, getButtonClass } from '@/lib/theme';
import { CollapsibleSection } from '@/app/components/ui/CollapsibleSection';
import {
  ResourceRow,
  AwsResourceTableBody,
  GroupedResourceTableBody,
  FlatResourceTableBody,
} from './resource-table';

interface ResourceTableProps {
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  credentials?: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
  onEditModeChange?: (isEdit: boolean) => void;
}

const WarningIcon = () => (
  <svg className={cn('w-4 h-4', statusColors.warning.text)} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

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
  const nonTargetResources = resources.filter(r => !r.isSelected && !selectedIdsSet.has(r.id));
  const vnetResources = nonTargetResources.filter(r => r.integrationCategory === 'INSTALL_INELIGIBLE');
  const normalNonTargetResources = nonTargetResources.filter(r => r.integrationCategory !== 'INSTALL_INELIGIBLE');

  const connectedCount = targetResources.filter((r) => r.connectionStatus === 'CONNECTED').length;
  const disconnectedCount = targetResources.filter((r) => r.connectionStatus === 'DISCONNECTED').length;
  const pendingCount = targetResources.filter((r) => !r.connectionStatus || r.connectionStatus === 'PENDING').length;

  const handleCheckboxChange = (resourceId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIdsSet);
    if (checked) {
      newSelectedIds.add(resourceId);
    } else {
      newSelectedIds.delete(resourceId);
    }
    onSelectionChange?.(Array.from(newSelectedIds));
  };

  const BodyComponent = {
    AWS: AwsResourceTableBody,
    Azure: GroupedResourceTableBody,
    GCP: GroupedResourceTableBody,
    IDC: FlatResourceTableBody,
    SDU: FlatResourceTableBody,
  }[cloudProvider];

  const baseColumnCount = (cloudProvider === 'IDC' || cloudProvider === 'SDU') ? 4 : 3;
  const colSpan = baseColumnCount + (isEditMode ? 1 : 0) + (showCredentialColumn ? 1 : 0) + (showConnectionStatus ? 1 : 0);

  const getCredentialsForType = (databaseType: DatabaseType): SecretKey[] =>
    filterCredentialsByType(credentials, databaseType);

  const rowProps = {
    cloudProvider,
    selectedIds: selectedIdsSet,
    isEditMode: false as const,
    isCheckboxEnabled: false,
    showConnectionStatus,
    showCredentialColumn,
    onCheckboxChange: handleCheckboxChange,
    getCredentialsForType,
    onCredentialChange,
    expandedVmId,
    onVmConfigToggle,
    onVmConfigSave,
  };

  const handleToggleEditMode = () => {
    const next = !internalEditMode;
    setInternalEditMode(next);
    onEditModeChange?.(next);
  };

  const bodyProps = {
    cloudProvider,
    selectedIds: selectedIdsSet,
    isCheckboxEnabled,
    showConnectionStatus,
    showCredentialColumn,
    onCheckboxChange: handleCheckboxChange,
    colSpan,
    getCredentialsForType,
    onCredentialChange,
    expandedVmId,
    onVmConfigToggle,
    onVmConfigSave,
  };

  const renderTable = (res: Resource[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <BodyComponent resources={res} isEditMode={isEditMode} {...bodyProps} />
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
        resources.length > 0 ? renderTable(resources) : (
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
          ) : renderTable(targetResources)}

          {/* Monitor mode: non-target resources */}
          {vnetResources.length > 0 && (
            <CollapsibleSection
              label="설치 불가 (VNet Integration)"
              count={vnetResources.length}
              icon={<WarningIcon />}
              labelClassName={statusColors.warning.textDark}
              contentClassName={cn('rounded-lg', statusColors.warning.bg)}
              defaultOpen
            >
              <table className="w-full">
                <tbody>
                  {vnetResources.map(r => (
                    <ResourceRow key={r.id} resource={r} {...rowProps} />
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>
          )}

          {normalNonTargetResources.length > 0 && (
            <CollapsibleSection
              label={targetResources.length === 0 ? '발견된 리소스' : '연동 제외 리소스'}
              count={normalNonTargetResources.length}
              contentClassName="opacity-60"
            >
              <table className="w-full">
                <BodyComponent
                  resources={normalNonTargetResources}
                  isEditMode={false}
                  {...bodyProps}
                  isCheckboxEnabled={false}
                />
              </table>
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
};
