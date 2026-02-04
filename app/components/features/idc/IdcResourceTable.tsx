'use client';

import { Resource, ProcessStatus, DBCredential, DatabaseType, needsCredential } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { filterCredentialsByType } from '@/lib/utils/credentials';
import { ConnectionIndicator } from '@/app/components/features/resource-table';

interface IdcResourceTableProps {
  resources: Resource[];
  processStatus: ProcessStatus;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

export const IdcResourceTable = ({
  resources,
  processStatus,
  credentials = [],
  onCredentialChange,
}: IdcResourceTableProps) => {
  const showCredentialColumn =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const showConnectionStatus =
    processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
    processStatus === ProcessStatus.CONNECTION_VERIFIED ||
    processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  const getCredentialsForType = (databaseType: DatabaseType): DBCredential[] => {
    return filterCredentialsByType(credentials, databaseType);
  };

  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            리소스 목록
          </h3>
          <span className="text-sm text-gray-500">총 {resources.length}개</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">데이터베이스</th>
              <th className="px-6 py-3">리소스 ID</th>
              {showCredentialColumn && (
                <th className="px-6 py-3">
                  <div className="flex items-center gap-1">
                    <span>Credential</span>
                    <div className="group relative">
                      <svg className="w-4 h-4 text-gray-400 cursor-help" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        DB 접속 정보를 선택하세요
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                </th>
              )}
              {showConnectionStatus && <th className="px-6 py-3">연결 상태</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.map((resource) => {
              const needsCred = needsCredential(resource.databaseType);
              const availableCredentials = needsCred ? getCredentialsForType(resource.databaseType) : [];
              const hasCredentialError = showCredentialColumn && needsCred && !resource.selectedCredentialId;

              return (
                <tr key={resource.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <DatabaseIcon type={resource.databaseType} size="sm" />
                      <span className="text-sm text-gray-700">
                        {getDatabaseLabel(resource.databaseType)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 font-mono text-sm">{resource.resourceId}</span>
                  </td>
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
                  {showConnectionStatus && (
                    <td className="px-6 py-4">
                      <ConnectionIndicator status={resource.connectionStatus} hasCredentialError={hasCredentialError} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
