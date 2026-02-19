'use client';

import { useState } from 'react';
import { ConnectionTestHistory, SecretKey, Resource, needsCredential } from '@/lib/types';
import { ConnectionHistoryTab } from '@/app/components/features/ConnectionHistoryTab';
import { CredentialListTab } from '@/app/components/features/CredentialListTab';
import { ConnectionDetailModal } from '@/app/components/features/ConnectionDetailModal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useModal } from '@/app/hooks/useModal';
import { MissingCredentialsTab } from './MissingCredentialsTab';
import { primaryColors, getButtonClass, cn } from '@/lib/theme';

type ConnectionTabType = 'history' | 'credentials' | 'missing';

interface ConnectionTestPanelProps {
  connectionTestHistory: ConnectionTestHistory[];
  credentials: SecretKey[];
  selectedResources: Resource[];
  onTestConnection?: () => void;
  testLoading?: boolean;
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

export const ConnectionTestPanel = ({
  connectionTestHistory,
  credentials,
  selectedResources,
  onTestConnection,
  testLoading,
  onCredentialChange,
}: ConnectionTestPanelProps) => {
  const [connectionTab, setConnectionTab] = useState<ConnectionTabType>('history');
  const connectionDetailModal = useModal<ConnectionTestHistory>();

  // 최신 테스트 결과
  const latestHistory = connectionTestHistory?.[0];

  // 마지막으로 성공한 테스트 기록
  const lastSuccessHistory = connectionTestHistory?.find(h => h.status === 'SUCCESS');

  // Credential 미설정 리소스
  const missingCredentialResources = selectedResources.filter(
    (r) => needsCredential(r.databaseType) && !r.selectedCredentialId
  );

  // rerender-derived-state-no-effect: 렌더 중 파생 상태 계산
  const [prevMissingCount, setPrevMissingCount] = useState(missingCredentialResources.length);
  if (missingCredentialResources.length !== prevMissingCount) {
    setPrevMissingCount(missingCredentialResources.length);
    if (missingCredentialResources.length === 0 && connectionTab === 'missing') {
      setConnectionTab('history');
    }
  }

  // Test Connection 클릭 핸들러
  const handleTestConnectionClick = () => {
    if (missingCredentialResources.length > 0) {
      setConnectionTab('missing');
    } else {
      onTestConnection?.();
    }
  };

  const handleShowLatestResult = () => {
    if (latestHistory) {
      connectionDetailModal.open(latestHistory);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더: 상태 + 버튼 */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        {lastSuccessHistory ? (
          <button
            onClick={() => connectionDetailModal.open(lastSuccessHistory)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-sm text-gray-600">마지막 연결 성공</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full mr-1 bg-green-500"></span>
              {new Date(lastSuccessHistory.executedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </button>
        ) : latestHistory ? (
          <button
            onClick={handleShowLatestResult}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-sm text-gray-600">최근 결과</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full mr-1 bg-red-500"></span>
              FAIL
            </span>
          </button>
        ) : (
          <span className="text-sm text-gray-600">설치 완료 - 연결 테스트를 실행하세요</span>
        )}
        <div className="relative group">
          <button
            onClick={handleTestConnectionClick}
            disabled={testLoading}
            className={cn(getButtonClass('primary', 'sm'), 'text-sm flex items-center gap-2')}
          >
            {testLoading && <LoadingSpinner />}
            {latestHistory ? '재실행' : 'Test Connection'}
          </button>
          {/* 툴팁 */}
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
              PII Agent 설치 이후 언제든 연결 테스트를 수행할 수 있습니다
              <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setConnectionTab('history')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            connectionTab === 'history'
              ? `${primaryColors.text} border-b-2 ${primaryColors.border} bg-white`
              : 'text-gray-500 hover:text-gray-700 bg-gray-50'
          }`}
        >
          DB 연결 History
        </button>
        <button
          onClick={() => setConnectionTab('credentials')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            connectionTab === 'credentials'
              ? `${primaryColors.text} border-b-2 ${primaryColors.border} bg-white`
              : 'text-gray-500 hover:text-gray-700 bg-gray-50'
          }`}
        >
          DB Credential 목록
        </button>
        {missingCredentialResources.length > 0 && (
          <button
            onClick={() => setConnectionTab('missing')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              connectionTab === 'missing'
                ? 'text-red-600 border-b-2 border-red-500 bg-white'
                : 'text-red-500 hover:text-red-700 bg-red-50'
            }`}
          >
            Credential 미설정
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
              {missingCredentialResources.length}
            </span>
          </button>
        )}
      </div>

      {/* 탭 내용 */}
      <div className="max-h-[200px] overflow-auto">
        {connectionTab === 'history' ? (
          <ConnectionHistoryTab history={connectionTestHistory || []} />
        ) : connectionTab === 'credentials' ? (
          <CredentialListTab credentials={credentials} />
        ) : (
          <MissingCredentialsTab
            resources={missingCredentialResources}
            credentials={credentials}
            onCredentialChange={onCredentialChange}
          />
        )}
      </div>

      {/* Connection Detail Modal */}
      {connectionDetailModal.data && (
        <ConnectionDetailModal
          history={connectionDetailModal.data}
          onClose={connectionDetailModal.close}
        />
      )}
    </div>
  );
};
