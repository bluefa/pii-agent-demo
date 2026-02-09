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
                onChange={(e) => onCheckboxChange(resource.id, e.target.checked)}
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
              {isVm && isCheckboxEnabled && isSelected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVmConfigToggle?.(isExpanded ? null : resource.id);
                  }}
                  className={cn(
                    'ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors',
                    hasVmConfig
                      ? cn(statusColors.pending.bg, textColors.tertiary, `hover:${bgColors.muted}`)
                      : cn(statusColors.warning.bg, statusColors.warning.textDark, `hover:${statusColors.warning.border}`, 'border', statusColors.warning.border)
                  )}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {hasVmConfig ? '설정 변경' : 'DB 설정'}
                </button>
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
        />
      )}
    </>
  );
};
