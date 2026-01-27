'use client';

import { Resource, DBCredential } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';

interface MissingCredentialsTabProps {
  resources: Resource[];
  credentials: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

export const MissingCredentialsTab = ({ resources, credentials, onCredentialChange }: MissingCredentialsTabProps) => {
  const getCredentialsForType = (databaseType: string) => {
    return credentials.filter((c) => c.databaseType === databaseType);
  };

  return (
    <div>
      {/* 안내 메시지 */}
      <div className="px-4 py-3 bg-red-50 border-b border-red-100">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-red-700">
            아래 리소스의 Credential을 선택한 후 Test Connection을 실행하세요.
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-2">인스턴스 타입</th>
            <th className="px-4 py-2">데이터베이스</th>
            <th className="px-4 py-2">리소스 ID</th>
            <th className="px-4 py-2">Credential</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {resources.map((resource) => {
            const availableCredentials = getCredentialsForType(resource.databaseType);
            return (
              <tr key={resource.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {resource.awsType && <AwsServiceIcon type={resource.awsType} />}
                    <span className="text-sm font-medium text-gray-900">
                      {resource.awsType || resource.type}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DatabaseIcon type={resource.databaseType} size="sm" />
                    <span className="text-sm text-gray-700">{getDatabaseLabel(resource.databaseType)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600 font-mono">{resource.resourceId}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={resource.selectedCredentialId || ''}
                    onChange={(e) => onCredentialChange?.(resource.id, e.target.value || null)}
                    className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${
                      resource.selectedCredentialId
                        ? 'border-green-300 bg-green-50 text-gray-900 focus:ring-green-500'
                        : 'border-red-300 bg-red-50 text-gray-700 focus:ring-red-500'
                    }`}
                  >
                    <option value="">선택하세요</option>
                    {availableCredentials.map((cred) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
