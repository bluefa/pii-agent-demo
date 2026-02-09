'use client';

import { Resource, DatabaseType, DBCredential, needsCredential, CloudProvider, VmDatabaseConfig } from '@/lib/types';
import { getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { ConnectionIndicator } from './ConnectionIndicator';
import { StatusIcon } from './StatusIcon';
import { VmDatabaseConfigPanel } from './VmDatabaseConfigPanel';
import { cn, textColors, statusColors, bgColors, colors } from '@/lib/theme';

// VM 리소스 타입 체크 헬퍼
export const isVmResource = (resource: Resource): boolean => {
  return resource.type === 'AZURE_VM' || resource.awsType === 'EC2';
};

interface ResourceRowProps {
  resource: Resource;
  isAWS: boolean;
  cloudProvider: CloudProvider;
  selectedIds: Set<string>;
  isEditMode: boolean;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  // VM 설정 관련
  expandedVmId?: string | null;
  onVmConfigToggle?: (resourceId: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
}

interface CredentialDisplayProps {
  needsCred: boolean;
  selectedCredentialId: string | undefined;
  availableCredentials: DBCredential[];
}

const CredentialDisplay = ({ needsCred, selectedCredentialId, availableCredentials }: CredentialDisplayProps) => {
  if (!needsCred) return <span className={cn('text-xs', textColors.quaternary)}>불필요</span>;

  const selectedCred = selectedCredentialId
    ? availableCredentials.find((c) => c.id === selectedCredentialId)
    : null;

  if (selectedCred) return <span className={cn('text-sm', textColors.primary)}>{selectedCred.name}</span>;

  return <span className={cn('text-sm font-medium', statusColors.error.text)}>미선택</span>;
};

export const ResourceRow = ({
  resource,
  isAWS,
  cloudProvider,
  selectedIds,
  isEditMode,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  getCredentialsForType,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
}: ResourceRowProps) => {
  const needsCred = needsCredential(resource.databaseType);
  const availableCredentials = needsCred ? getCredentialsForType(resource.databaseType) : [];
  const hasCredentialError = showCredentialColumn && needsCred && resource.isSelected && !resource.selectedCredentialId;

  const isVm = isVmResource(resource);
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
          isVm && isSelected && !hasVmConfig && !isExpanded && statusColors.warning.bg
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
                disabled={!!resource.exclusion}
                onChange={(e) => {
                  onCheckboxChange(resource.id, e.target.checked);
                  if (isVm && e.target.checked) onVmConfigToggle?.(resource.id);
                  if (isVm && !e.target.checked) onVmConfigToggle?.(null);
                }}
                className={cn('w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed', statusColors.pending.border, `text-${colors.primary.base}`, `focus:ring-${colors.primary.base}`)}
              />
            )}
          </td>
        )}

        {/* Instance Type — AWS는 그룹 헤더에 표시되므로 행에서 생략 */}
        {!isAWS && (
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              {cloudProvider === 'Azure' && isAzureResourceType(resource.type) && (
                <AzureServiceIcon type={resource.type} size="lg" />
              )}
              <span className={cn('font-medium', textColors.primary)}>{resource.type}</span>
              {isVm && isSelected && !hasVmConfig && (
                <span className={cn('text-xs ml-1', statusColors.warning.textDark)}>(DB 설정 필요)</span>
              )}
            </div>
          </td>
        )}

        {/* Resource ID */}
        <td className="px-6 py-4">
          <span className={cn('font-mono text-sm', textColors.tertiary)}>{resource.resourceId}</span>
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
                    `w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-${colors.primary.base}`,
                    hasCredentialError
                      ? cn(statusColors.error.border, statusColors.error.bg, statusColors.error.textDark)
                      : resource.selectedCredentialId
                      ? cn(statusColors.success.border, statusColors.success.bg, textColors.primary)
                      : cn(statusColors.pending.border, textColors.primary)
                  )}
                >
                  <option value="">{hasCredentialError ? '미선택' : '선택하세요'}</option>
                  {availableCredentials.map((cred) => (
                    <option key={cred.id} value={cred.id}>
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
            {resource.isNew && <StatusIcon type="new" />}
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
    </>
  );
};
