'use client';

import { Resource, DatabaseType, DBCredential, needsCredential } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { ConnectionIndicator } from './ConnectionIndicator';
import { StatusIcon } from './StatusIcon';

interface ResourceRowProps {
  resource: Resource;
  isAWS: boolean;
  selectedIds: Set<string>;
  isCheckboxEnabled: boolean;
  showConnectionStatus: boolean;
  showCredentialColumn: boolean;
  onCheckboxChange: (id: string, checked: boolean) => void;
  getCredentialsForType: (databaseType: DatabaseType) => DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

export const ResourceRow = ({
  resource,
  isAWS,
  selectedIds,
  isCheckboxEnabled,
  showConnectionStatus,
  showCredentialColumn,
  onCheckboxChange,
  getCredentialsForType,
  onCredentialChange,
}: ResourceRowProps) => {
  const needsCred = needsCredential(resource.databaseType);
  const availableCredentials = needsCred ? getCredentialsForType(resource.databaseType) : [];
  const hasCredentialError = showCredentialColumn && needsCred && resource.isSelected && !resource.selectedCredentialId;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Checkbox */}
      <td className="px-6 py-4 w-12">
        {isCheckboxEnabled && (
          <input
            type="checkbox"
            checked={selectedIds.has(resource.id)}
            onChange={(e) => onCheckboxChange(resource.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
      </td>

      {/* Instance Type */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {isAWS && resource.awsType && <AwsServiceIcon type={resource.awsType} size="lg" />}
          <span className="font-medium text-gray-900">{resource.awsType || resource.type}</span>
        </div>
      </td>

      {/* Database Type */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <DatabaseIcon type={resource.databaseType} size="sm" />
          <span className="text-sm text-gray-700">{getDatabaseLabel(resource.databaseType)}</span>
        </div>
      </td>

      {/* Resource ID */}
      <td className="px-6 py-4">
        <span className="text-gray-600 font-mono text-sm">{resource.resourceId}</span>
      </td>

      {/* Credential */}
      {showCredentialColumn && (
        <td className="px-6 py-4">
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
          {resource.isNew && <StatusIcon type="new" />}
          {resource.connectionStatus === 'DISCONNECTED' && <StatusIcon type="disconnected" />}
        </div>
      </td>
    </tr>
  );
};
