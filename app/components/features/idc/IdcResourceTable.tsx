'use client';

import { Resource, ProcessStatus, DBCredential, DatabaseType, needsCredential } from '@/lib/types';
import { IdcResourceInput } from '@/lib/types/idc';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { filterCredentialsByType } from '@/lib/utils/credentials';
import { ConnectionIndicator } from '@/app/components/features/resource-table';

interface IdcResourceTableProps {
  resources: Resource[];
  processStatus: ProcessStatus;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  // 편집 모드
  isEditMode?: boolean;
  onRemove?: (resourceId: string) => void;
  onAdd?: () => void;
  // 편집 모드에서 추가된 임시 리소스
  pendingInputs?: IdcResourceInput[];
  onRemovePendingInput?: (index: number) => void;
}

// 표시용 리소스 정보 생성
const getDisplayResourceId = (input: IdcResourceInput): string => {
  const hostInfo = input.inputFormat === 'IP'
    ? (input.ips?.join(', ') || '')
    : (input.host || '');
  return `${input.name} (${hostInfo}:${input.port})`;
};

export const IdcResourceTable = ({
  resources,
  processStatus,
  credentials = [],
  onCredentialChange,
  isEditMode = false,
  onRemove,
  onAdd,
  pendingInputs = [],
  onRemovePendingInput,
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

  const totalCount = resources.length + pendingInputs.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            리소스 목록
          </h3>
          <span className="text-sm text-gray-500">
            총 {totalCount}개{pendingInputs.length > 0 && ` (미저장 ${pendingInputs.length}개)`}
          </span>
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
              {isEditMode && <th className="px-6 py-3 w-16"></th>}
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
                  {isEditMode && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => onRemove?.(resource.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {/* 편집 모드에서 추가된 임시 리소스 (미저장) */}
            {pendingInputs.map((input, index) => (
              <tr key={`pending-${index}`} className="hover:bg-gray-50 transition-colors bg-blue-50/30">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <DatabaseIcon type={input.databaseType} size="sm" />
                    <span className="text-sm text-gray-700">
                      {getDatabaseLabel(input.databaseType)}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">미저장</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-600 font-mono text-sm">{getDisplayResourceId(input)}</span>
                </td>
                {showCredentialColumn && (
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-400">저장 후 선택 가능</span>
                  </td>
                )}
                {showConnectionStatus && (
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-400">-</span>
                  </td>
                )}
                {isEditMode && (
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onRemovePendingInput?.(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="삭제"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {/* Inline Add Row - Notion/Airtable 스타일 */}
            {isEditMode && onAdd && (
              <tr
                onClick={onAdd}
                className="hover:bg-blue-50 cursor-pointer transition-colors group"
              >
                <td
                  colSpan={2 + (showCredentialColumn ? 1 : 0) + (showConnectionStatus ? 1 : 0) + 1}
                  className="px-6 py-3"
                >
                  <div className="flex items-center gap-2 text-gray-400 group-hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">새 리소스 추가</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
