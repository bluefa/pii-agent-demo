'use client';

import {
  Resource,
  CloudProvider,
  ProcessStatus,
  SecretKey,
  VmDatabaseConfig,
} from '@/lib/types';

import { cn, textColors, primaryColors } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';
import { FlatResourceTableBody } from './resource-table';

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
  onRequestApproval?: () => void;
  approvalSubmitting?: boolean;
}

export const ResourceTable = ({
  resources,
  cloudProvider,
  processStatus,
  isEditMode = false,
  selectedIds: externalSelectedIds,
  onSelectionChange,
  credentials = [],
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
  onRequestApproval,
  approvalSubmitting = false,
}: ResourceTableProps) => {
  const selectedIdsSet = new Set(
    externalSelectedIds ?? resources.filter((r) => r.isSelected).map((r) => r.id)
  );

  const isCheckboxEnabled =
    processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION || isEditMode;
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const handleCheckboxChange = (resourceId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIdsSet);
    if (checked) {
      newSelectedIds.add(resourceId);
    } else {
      newSelectedIds.delete(resourceId);
    }
    onSelectionChange?.(Array.from(newSelectedIds));
  };

  const VISIBLE_DATA_COLUMNS = 7;
  const colSpan = VISIBLE_DATA_COLUMNS + (isEditMode ? 1 : 0) + (showCredentialColumn ? 1 : 0);

  const bodyProps = {
    cloudProvider,
    processStatus,
    selectedIds: selectedIdsSet,
    isCheckboxEnabled,
    showCredentialColumn,
    onCheckboxChange: handleCheckboxChange,
    colSpan,
    credentials,
    onCredentialChange,
    expandedVmId,
    onVmConfigToggle,
    onVmConfigSave,
  };

  const totalCount = resources.length;
  const selectedCount = selectedIdsSet.size;
  const showSummary = onRequestApproval !== undefined && isEditMode;

  return (
    <div>
      {resources.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <FlatResourceTableBody resources={resources} isEditMode={isEditMode} {...bodyProps} />
            </table>
          </div>
        </div>
      ) : (
        <div className={cn('rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm', textColors.tertiary)}>
          발견된 리소스가 없습니다
        </div>
      )}

      {showSummary && (
        <div className="flex justify-between items-center pt-4">
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
