'use client';

import React, { useState } from 'react';
import {
  Resource,
  CloudProvider,
  ProcessStatus,
  SecretKey,
  VmDatabaseConfig,
} from '@/lib/types';

import { cn, textColors, badgeStyles, primaryColors, getButtonClass, statusColors } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';
import {
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

  const targetCount = resources.filter(
    (r) => r.isSelected || selectedIdsSet.has(r.id),
  ).length;

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

  const totalCount = resources.length;
  const selectedCount = isEditMode ? selectedIdsSet.size : targetCount;
  const showSummary = onRequestApproval !== undefined && isEditMode;

  return (
    <div>
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', textColors.primary)}>리소스</span>
          <span className={cn(badgeStyles.base, badgeStyles.sizes.sm, statusColors.info.bg, statusColors.info.textDark)}>
            {selectedCount}/{totalCount}
          </span>
        </div>
        {!externalEditMode && targetCount > 0 && (
          <button
            onClick={handleToggleEditMode}
            className={getButtonClass(internalEditMode ? 'secondary' : 'ghost', 'sm')}
          >
            {internalEditMode ? '수정 완료' : '대상 수정'}
          </button>
        )}
      </div>

      {resources.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <BodyComponent resources={resources} isEditMode={isEditMode} {...bodyProps} />
          </table>
        </div>
      ) : (
        <div className={cn('px-6 py-10 text-center text-sm', textColors.tertiary)}>
          발견된 리소스가 없습니다
        </div>
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
