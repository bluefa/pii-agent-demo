'use client';

import { useState, useEffect } from 'react';
import { AwsInstallationStatus } from '@/lib/types';
import { getAwsInstallationStatus, checkAwsInstallation } from '@/app/lib/api/aws';
import { TfRoleGuideModal } from '@/app/components/features/process-status/aws/TfRoleGuideModal';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';

interface AwsInstallationInlineProps {
  projectId: string;
  onInstallComplete?: () => void;
}

// TF 상태 행 컴포넌트
const TfStatusRow = ({
  label,
  completed,
  inProgress,
}: {
  label: string;
  completed: boolean;
  inProgress?: boolean;
}) => {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center gap-3">
        {completed ? (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : inProgress ? (
          <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
        )}
        <span className={`text-sm font-medium ${completed ? 'text-green-700' : 'text-gray-700'}`}>
          {label}
        </span>
      </div>
      <span className={`text-xs font-medium ${
        completed ? 'text-green-600' : inProgress ? 'text-orange-600' : 'text-gray-400'
      }`}>
        {completed ? '완료' : inProgress ? '진행 중' : '대기 중'}
      </span>
    </div>
  );
};

export const AwsInstallationInline = ({
  projectId,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const [status, setStatus] = useState<AwsInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(false);

  // 상태 조회
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAwsInstallationStatus(projectId);
      setStatus(data);

      // 설치 완료 시 콜백
      if (data.serviceTfCompleted && data.bdcTfCompleted) {
        onInstallComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 새로고침
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkAwsInstallation(projectId);
      setStatus(data);

      if (data.serviceTfCompleted && data.bdcTfCompleted) {
        onInstallComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  // TF Script 다운로드
  const handleDownloadScript = () => {
    window.open(`/api/aws/projects/${projectId}/terraform-script`, '_blank');
  };

  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  // 진행률 계산
  const completedCount = status ?
    (status.serviceTfCompleted ? 1 : 0) + (status.bdcTfCompleted ? 1 : 0) : 0;
  const totalCount = 2;

  // 로딩 상태
  if (loading) {
    return (
      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">AWS 설치 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={fetchStatus} className="text-sm text-red-700 hover:underline">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">AWS 설치 상태</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              completedCount === totalCount
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {completedCount}/{totalCount} 완료
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="새로고침"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TF 상태 목록 */}
      <div className="p-4 space-y-3 bg-white">
        {/* 설치 모드 안내 */}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            status.hasTfPermission ? 'bg-blue-50' : 'bg-gray-50'
          }`}>
            {status.hasTfPermission ? (
              <>
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-700">자동 설치 모드</span>
                    <button
                      onClick={() => setShowRoleGuide(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Role 등록 가이드
                    </button>
                  </div>
                  <p className="text-xs text-blue-600">시스템이 자동으로 Terraform을 실행합니다.</p>
                </div>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">수동 설치 모드</span>
                    <button
                      onClick={() => setShowScriptGuide(true)}
                      className="text-xs text-gray-600 hover:text-gray-700 underline"
                    >
                      설치 가이드
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">TF Script를 다운로드하여 직접 실행해주세요.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Service TF */}
        <TfStatusRow
          label="Service TF"
          completed={status?.serviceTfCompleted ?? false}
          inProgress={!status?.serviceTfCompleted && status?.hasTfPermission}
        />

        {/* BDC TF */}
        <TfStatusRow
          label="BDC TF"
          completed={status?.bdcTfCompleted ?? false}
          inProgress={status?.serviceTfCompleted && !status?.bdcTfCompleted}
        />

        {/* 수동 설치 안내 (hasTfPermission = false) */}
        {status && !status.hasTfPermission && !status.serviceTfCompleted && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700 mb-3">
              TF Script를 다운로드 받아서 담당자와 함께 설치 일정을 조율하세요.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadScript}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                TF Script 다운로드
              </button>
              <button
                onClick={() => setShowScriptGuide(true)}
                className="text-sm text-amber-600 hover:text-amber-700 underline"
              >
                설치 가이드 보기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 가이드 모달 */}
      {showRoleGuide && (
        <TfRoleGuideModal onClose={() => setShowRoleGuide(false)} />
      )}
      {showScriptGuide && (
        <TfScriptGuideModal onClose={() => setShowScriptGuide(false)} />
      )}
    </div>
  );
};
