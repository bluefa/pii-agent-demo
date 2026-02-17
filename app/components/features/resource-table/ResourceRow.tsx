'use client';

import { createPortal } from 'react-dom';
import { Resource, DatabaseType, SecretKey, needsCredential, CloudProvider, VmDatabaseConfig } from '@/lib/types';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { ConnectionIndicator } from './ConnectionIndicator';
import { StatusIcon } from './StatusIcon';
import { VmDatabaseConfigPanel } from './VmDatabaseConfigPanel';
import { VnetIntegrationGuideModal } from './VnetIntegrationGuideModal';
import { useModal } from '@/app/hooks/useModal';
import { cn, textColors, statusColors, bgColors, primaryColors } from '@/lib/theme';

// VM 리소스 타입 체크 헬퍼
export const isVmResource = (resource: Resource): boolean => {
  return resource.type === 'AZURE_VM' || resource.awsType === 'EC2';
};

interface ResourceRowProps {
  resource: Resource;
  cloudProvider: CloudProvider;
  hideTypeColumn?: boolean;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  credentials: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  // VM 설정 관련
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

interface CredentialDisplayProps {
  needsCred: boolean;
  selectedCredentialId: string | undefined;
  availableCredentials: SecretKey[];
}

const CredentialDisplay = ({ needsCred, selectedCredentialId, availableCredentials }: CredentialDisplayProps) => {
  if (!needsCred) return <span className={cn('text-xs', textColors.quaternary)}>불필요</span>;

  const selectedCred = selectedCredentialId
    ? availableCredentials.find((c) => c.name === selectedCredentialId)
    : null;

  if (selectedCred) return <span className={cn('text-sm', textColors.primary)}>{selectedCred.name}</span>;

  return <span className={cn('text-sm font-medium', statusColors.error.text)}>미선택</span>;
};

export const ResourceRow = ({
  resource,
  cloudProvider,
  hideTypeColumn,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  credentials,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: ResourceRowProps) => {
  const vnetModal = useModal();
  const needsCred = needsCredential(resource.databaseType);
  const availableCredentials = needsCred ? credentials : [];
  const hasCredentialError = showCredentialColumn && needsCred && resource.isSelected && !resource.selectedCredentialId;

  const isVm = isVmResource(resource);
  const isVnetIneligible = resource.integrationCategory === 'INSTALL_INELIGIBLE';
  const isExpanded = expandedVmId === resource.id;
  const isSelected = selectedIds.has(resource.id);
  const hasVmConfig = !!resource.vmDatabaseConfig;

  const handleRowClick = () => {
    if (isVm && isCheckboxEnabled && isSelected && onVmConfigToggle) {
      onVmConfigToggle(isExpanded ? null : resource.id);
    }
  };

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    onVmConfigSave?.(resourceId, config);
    onVmConfigToggle?.(null);
  };

  return (
    <>
      <tr
        className={cn(
          'transition-colors',
          `hover:${bgColors.muted}`,
          isVm && isCheckboxEnabled && isSelected && 'cursor-pointer',
          isExpanded && statusColors.info.bg,
          isVm && isSelected && !hasVmConfig && !isExpanded && statusColors.warning.bg,
          isVnetIneligible && 'opacity-60'
        )}
        onClick={handleRowClick}
      >
        {/* Checkbox — 편집 모드에서만 표시 */}
        {isEditMode && (
          <td className="px-6 py-4 w-12" onClick={(e) => e.stopPropagation()}>
            {isCheckboxEnabled && (
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!!resource.exclusion || isVnetIneligible}
                onChange={(e) => {
                  onCheckboxChange(resource.id, e.target.checked);
                  if (isVm && e.target.checked) onVmConfigToggle?.(resource.id);
                  if (isVm && !e.target.checked) onVmConfigToggle?.(null);
                }}
                className={cn('w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed', statusColors.pending.border, primaryColors.text, primaryColors.focusRing)}
              />
            )}
          </td>
        )}

        {/* Instance Type — Provider별 렌더링 (AWS는 ResourceTypeGroup 헤더에 표시) */}
        {!hideTypeColumn && cloudProvider === 'Azure' && (
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              {isAzureResourceType(resource.type) && <AzureServiceIcon type={resource.type} size="lg" />}
              <span className={cn('font-medium', textColors.primary)}>{resource.type}</span>
              {isVm && isSelected && !hasVmConfig && (
                <span className={cn('text-xs ml-1', statusColors.warning.textDark)}>(DB 설정 필요)</span>
              )}
              {isVnetIneligible && (
                <button
                  onClick={(e) => { e.stopPropagation(); vnetModal.open(); }}
                  className={cn('ml-1 flex-shrink-0 inline-flex items-center gap-1', statusColors.warning.text, 'hover:underline transition-opacity')}
                  aria-label="VNet Integration으로 인해 설치 불가 - 클릭하여 상세 안내 보기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>설치 불가</span>
                </button>
              )}
            </div>
          </td>
        )}
        {!hideTypeColumn && (cloudProvider === 'GCP' || cloudProvider === 'IDC' || cloudProvider === 'SDU') && (
          <td className="px-6 py-4">
            <span className={cn('font-medium', textColors.primary)}>{resource.type}</span>
          </td>
        )}

        {/* Resource ID */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-sm', textColors.tertiary)}>{resource.resourceId}</span>
            {hideTypeColumn && isVnetIneligible && (
              <button
                onClick={(e) => { e.stopPropagation(); vnetModal.open(); }}
                className={cn('flex-shrink-0 inline-flex items-center gap-1', statusColors.warning.text, 'hover:underline transition-opacity')}
                aria-label="VNet Integration으로 인해 설치 불가 - 클릭하여 상세 안내 보기"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className={cn('text-xs font-medium', statusColors.warning.textDark)}>설치 불가</span>
              </button>
            )}
          </div>
        </td>

        {/* Database Type */}
        <td className="px-6 py-4">
          {isVm && hasVmConfig ? (
            <span className={cn('text-sm', textColors.primary)}>
              {getDatabaseLabel(resource.vmDatabaseConfig!.databaseType)}
            </span>
          ) : (
            <span className={cn('text-sm', textColors.secondary)}>{getDatabaseLabel(resource.databaseType)}</span>
          )}
        </td>

        {/* Credential */}
        {showCredentialColumn && (
          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
            {isEditMode ? (
              needsCred ? (
                <select
                  value={resource.selectedCredentialId || ''}
                  onChange={(e) => onCredentialChange?.(resource.id, e.target.value || null)}
                  className={cn(
                    `w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 ${primaryColors.focusRing}`,
                    hasCredentialError
                      ? cn(statusColors.error.border, statusColors.error.bg, statusColors.error.textDark)
                      : resource.selectedCredentialId
                      ? cn(statusColors.success.border, statusColors.success.bg, textColors.primary)
                      : cn(statusColors.pending.border, textColors.primary)
                  )}
                >
                  <option value="">{hasCredentialError ? '미선택' : '선택하세요'}</option>
                  {availableCredentials.map((cred) => (
                    <option key={cred.name} value={cred.name}>
                      {cred.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={cn('text-xs', textColors.quaternary)}>불필요</span>
              )
            ) : (
              <CredentialDisplay
                needsCred={needsCred}
                selectedCredentialId={resource.selectedCredentialId}
                availableCredentials={availableCredentials}
              />
            )}
          </td>
        )}

        {/* Connection Status */}
        {showConnectionStatus && (
          <td className="px-6 py-4">
            <ConnectionIndicator status={resource.connectionStatus} hasCredentialError={hasCredentialError} />
          </td>
        )}

        {/* Status Icons */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-1">
            {resource.isSelected && <StatusIcon type="selected" />}
            {isVm && hasVmConfig && <StatusIcon type="configured" />}
            {isVm && isSelected && !hasVmConfig && <StatusIcon type="needsConfig" />}

            {resource.connectionStatus === 'DISCONNECTED' && <StatusIcon type="disconnected" />}
          </div>
        </td>
      </tr>

      {/* VM Configuration Panel */}
      {isExpanded && (
        <VmDatabaseConfigPanel
          resourceId={resource.id}
          initialConfig={resource.vmDatabaseConfig}
          onSave={handleVmConfigSave}
          onCancel={() => onVmConfigToggle?.(null)}
          nics={resource.type === 'AZURE_VM' ? resource.nics : undefined}
        />
      )}

      {isVnetIneligible && typeof document !== 'undefined' && createPortal(
        <VnetIntegrationGuideModal isOpen={vnetModal.isOpen} onClose={vnetModal.close} resourceId={resource.resourceId} />,
        document.body
      )}
    </>
  );
};
