'use client';

import { Resource, DatabaseType, DBCredential, needsCredential, CloudProvider, VmDatabaseConfig } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { ConnectionIndicator } from './ConnectionIndicator';
import { StatusIcon } from './StatusIcon';
import { VmDatabaseConfigPanel } from './VmDatabaseConfigPanel';

// VM 리소스 타입 체크 헬퍼
export const isVmResource = (resource: Resource): boolean => {
  return resource.type === 'AZURE_VM' || resource.awsType === 'EC2';
};

interface ResourceRowProps {
  resource: Resource;
  isAWS: boolean;
  cloudProvider: CloudProvider;
  selectedIds: Set<string>;
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

export const ResourceRow = ({
  resource,
  isAWS,
  cloudProvider,
  selectedIds,
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
        className={`hover:bg-gray-50 transition-colors ${isVm && isCheckboxEnabled && isSelected ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={handleRowClick}
      >
        {/* Checkbox */}
        <td className="px-6 py-4 w-12" onClick={(e) => e.stopPropagation()}>
          {isCheckboxEnabled && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onCheckboxChange(resource.id, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}
        </td>

        {/* Instance Type */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            {isAWS && resource.awsType && <AwsServiceIcon type={resource.awsType} size="lg" />}
            {cloudProvider === 'Azure' && isAzureResourceType(resource.type) && (
              <AzureServiceIcon type={resource.type} size="lg" />
            )}
            <span className="font-medium text-gray-900">{resource.awsType || resource.type}</span>
            {isVm && isCheckboxEnabled && isSelected && (
              <span className="text-xs text-blue-600 ml-1">(클릭하여 설정)</span>
            )}
          </div>
        </td>

        {/* Database Type */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            {isVm && hasVmConfig ? (
              <>
                <DatabaseIcon type={resource.vmDatabaseConfig!.databaseType} size="sm" />
                <span className="text-sm text-gray-700">
                  {getDatabaseLabel(resource.vmDatabaseConfig!.databaseType)}
                </span>
                <span className="text-xs text-gray-500">
                  (:{resource.vmDatabaseConfig!.port})
                </span>
              </>
            ) : (
              <>
                <DatabaseIcon type={resource.databaseType} size="sm" />
                <span className="text-sm text-gray-700">{getDatabaseLabel(resource.databaseType)}</span>
              </>
            )}
          </div>
        </td>

        {/* Resource ID */}
        <td className="px-6 py-4">
          <span className="text-gray-600 font-mono text-sm">{resource.resourceId}</span>
        </td>

        {/* Credential */}
        {showCredentialColumn && (
          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
            {needsCred ? (
              <select
                value={resource.selectedCredentialId || ''}
                onChange={(e) => onCredentialChange?.(resource.id, e.target.value || null)}
                className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  hasCredentialError
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : resource.selectedCredentialId
                    ? 'border-green-300 bg-green-50 text-gray-900'
                    : 'border-gray-300 text-gray-900'
                }`}
              >
                <option value="">{hasCredentialError ? '미선택' : '선택하세요'}</option>
                {availableCredentials.map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-400">불필요</span>
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
