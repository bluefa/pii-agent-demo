'use client';

import React, { useState } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  SecretKey,
  VmDatabaseConfig,
} from '@/lib/types';

import { cn, statusColors, textColors, badgeStyles, primaryColors, getButtonClass } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';
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
  onRequestApproval?: () => void;
  approvalSubmitting?: boolean;
}

const WarningIcon = () => (
  <svg className={cn('w-4 h-4', statusColors.warning.text)} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);

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
  onRequestApproval,
  approvalSubmitting = false,
}: ResourceTableProps) => {
  const [internalEditMode, setInternalEditMode] = useState(false);

  const selectedIdsSet = new Set(
    externalSelectedIds ?? resources.filter((r) => r.isSelected).map((r) => r.id)
  );

  const isEditMode = externalEditMode || internalEditMode;
  const isCheckboxEnabled =
    processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION || isEditMode;
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const targetResources: Resource[] = [];
  const vnetResources: Resource[] = [];
  const normalNonTargetResources: Resource[] = [];
  for (const r of resources) {
    if (r.isSelected || selectedIdsSet.has(r.id)) targetResources.push(r);
    else if (r.integrationCategory === 'INSTALL_INELIGIBLE') vnetResources.push(r);
    else normalNonTargetResources.push(r);
  }

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

  const VISIBLE_DATA_COLUMNS = 7;
  const colSpan = VISIBLE_DATA_COLUMNS + (isEditMode ? 1 : 0) + (showCredentialColumn ? 1 : 0);

  const rowProps = {
    selectedIds: selectedIdsSet,
    processStatus,
    isEditMode: false as const,
    isCheckboxEnabled: false,
    showCredentialColumn,
    onCheckboxChange: handleCheckboxChange,
    credentials: credentials || [],
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
    processStatus,
    selectedIds: selectedIdsSet,
    isCheckboxEnabled,
    showCredentialColumn,
    onCheckboxChange: handleCheckboxChange,
    colSpan,
    credentials: credentials || [],
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

  const selectedCount = selectedIdsSet.size;
  const totalCount = resources.length;
  const showSummary = onRequestApproval !== undefined && isEditMode;

  return (
    <div>
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', textColors.primary)}>
            {isEditMode ? '전체 리소스' : '리소스'}
          </span>
          <span className={cn(badgeStyles.base, badgeStyles.sizes.sm, statusColors.info.bg, statusColors.info.textDark)}>
            {isEditMode ? `${selectedIdsSet.size}/${resources.length} 선택` : targetResources.length}
          </span>
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

      {isEditMode ? (
        resources.length > 0 ? renderTable(resources) : (
          <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
            발견된 리소스가 없습니다
          </div>
        )
      ) : (
        <>
          {targetResources.length === 0 ? (
            <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
              아직 연동 대상이 선택되지 않았습니다
            </div>
          ) : renderTable(targetResources)}

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

      {showSummary && (
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 mt-2">
          <span className={cn('text-xs', textColors.tertiary)}>
            총 <strong className={textColors.primary}>{totalCount}</strong>건 ·{' '}
            <strong className={primaryColors.text}>{selectedCount}</strong>건 선택됨
          </span>
          <Button
            variant="primary"
            onClick={onRequestApproval}
            disabled={approvalSubmitting || selectedCount === 0}
          >
            연동 대상 승인 요청
          </Button>
        </div>
      )}
    </div>
  );
};
