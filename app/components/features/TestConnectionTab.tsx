'use client';

import { useState, useEffect } from 'react';
import { Project, DBCredential, ConnectionTestResult, needsCredential, Resource } from '../../../lib/types';
import { getCredentials, runConnectionTest, ResourceCredentialInput } from '../../lib/api';

interface TestConnectionTabProps {
  project: Project;
  onProjectUpdate: (project: Project) => void;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  AUTH_FAILED: '인증 실패',
  PERMISSION_DENIED: '권한 부족',
  NETWORK_ERROR: '네트워크 오류',
  TIMEOUT: '연결 타임아웃',
  UNKNOWN_ERROR: '알 수 없는 오류',
};

export const TestConnectionTab = ({ project, onProjectUpdate }: TestConnectionTabProps) => {
  const [credentials, setCredentials] = useState<DBCredential[]>([]);
  const [resourceCredentialMap, setResourceCredentialMap] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<ConnectionTestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // 선택된 리소스만 (테스트 대상)
  const selectedResources = project.resources.filter((r) => r.isSelected);

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        setLoadingCredentials(true);
        const creds = await getCredentials(project.id);
        setCredentials(creds || []);
      } catch (err) {
        console.error('Failed to fetch credentials:', err);
        setCredentials([]);
      } finally {
        setLoadingCredentials(false);
      }
    };
    fetchCredentials();
  }, [project.id]);

  const handleCredentialChange = (resourceId: string, credentialId: string) => {
    setResourceCredentialMap((prev) => ({
      ...prev,
      [resourceId]: credentialId,
    }));
    // 결과 초기화 (credential 변경 시)
    setTestResults([]);
  };

  const handleRunTest = async () => {
    // Credential 필요한 리소스에 credential이 선택되었는지 확인
    const missingCredentials = selectedResources.filter(
      (r) => needsCredential(r.databaseType) && !resourceCredentialMap[r.id]
    );

    if (missingCredentials.length > 0) {
      alert(`다음 리소스에 Credential을 선택해주세요:\n${missingCredentials.map((r) => r.resourceId).join('\n')}`);
      return;
    }

    try {
      setLoading(true);
      const resourceCredentials: ResourceCredentialInput[] = selectedResources.map((r) => ({
        resourceId: r.id,
        credentialId: resourceCredentialMap[r.id],
      }));

      const response = await runConnectionTest(project.id, resourceCredentials);
      setTestResults(response.history.results);
      onProjectUpdate(response.project);
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getResultForResource = (resourceId: string) => {
    return testResults.find((r) => r.resourceId === resourceId);
  };

  const getCredentialsForType = (databaseType: string): DBCredential[] => {
    return (credentials || []).filter((c) => c.databaseType === databaseType);
  };

  const renderStatus = (resource: Resource) => {
    const result = getResultForResource(resource.id);

    if (!result) {
      // 테스트 전
      if (needsCredential(resource.databaseType) && !resourceCredentialMap[resource.id]) {
        return (
          <span className="text-orange-500 flex items-center gap-1">
            <span>!</span>
            <span>Credential 미선택</span>
          </span>
        );
      }
      return (
        <span className="text-gray-400 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span>대기중</span>
        </span>
      );
    }

    if (result.success) {
      return (
        <span className="text-green-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>연결됨</span>
        </span>
      );
    }

    return (
      <div>
        <span className="text-red-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span>{result.error ? ERROR_TYPE_LABELS[result.error.type] : '실패'}</span>
        </span>
        {result.error && (
          <p className="text-xs text-red-400 mt-1">{result.error.message}</p>
        )}
      </div>
    );
  };

  if (loadingCredentials) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const allTestsPassed = testResults.length > 0 && testResults.every((r) => r.success);

  return (
    <div className="space-y-6">
      {/* Credential 안내 섹션 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-blue-800 font-medium">DB Credential 등록</h4>
            <p className="text-blue-600 text-sm mt-1">
              RDS, PostgreSQL, Redshift 리소스 연결을 위해 DB Credential이 필요합니다.
              <br />
              DynamoDB, Athena는 AWS IAM 권한으로 연결되므로 별도 Credential이 필요하지 않습니다.
            </p>
            <a
              href="#"
              className="text-blue-700 text-sm font-medium mt-2 inline-flex items-center gap-1 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                alert('Credential 관리 페이지로 이동합니다. (데모에서는 미구현)');
              }}
            >
              Credential 관리 페이지로 이동
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* 리소스 테스트 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            리소스 연결 테스트
            <span className="text-gray-500 font-normal ml-2">총 {selectedResources.length}개 리소스</span>
          </h3>
          <button
            onClick={handleRunTest}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
              </svg>
            )}
            Test Connection
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">타입</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">리소스 ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Credential</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody>
            {selectedResources.map((resource) => {
              const needsCred = needsCredential(resource.databaseType);
              const availableCredentials = needsCred ? getCredentialsForType(resource.databaseType) : [];

              return (
                <tr key={resource.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {resource.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{resource.resourceId}</td>
                  <td className="px-4 py-3">
                    {needsCred ? (
                      <select
                        value={resourceCredentialMap[resource.id] || ''}
                        onChange={(e) => handleCredentialChange(resource.id, e.target.value)}
                        disabled={loading}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">선택하세요</option>
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
                  <td className="px-4 py-3 text-sm">{renderStatus(resource)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 성공 메시지 */}
      {allTestsPassed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-green-800 font-medium">모든 연결 테스트 완료</h4>
              <p className="text-green-600 text-sm mt-1">
                모든 리소스가 정상적으로 연결되었습니다. 설치가 완료되었습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
