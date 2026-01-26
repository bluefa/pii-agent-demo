'use client';

import { useState, useEffect } from 'react';
import { ProcessStatus, Project, TerraformStatus, ConnectionTestHistory, DBCredential, needsCredential, AwsResourceType } from '../../../lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';
import { ConnectionDetailModal } from './ConnectionDetailModal';
import { ConnectionHistoryTab } from './ConnectionHistoryTab';
import { CredentialListTab } from './CredentialListTab';
import { DatabaseIcon, getDatabaseLabel } from '../ui/DatabaseIcon';
import { approveProject, rejectProject, confirmCompletion } from '../../lib/api';

type ConnectionTabType = 'history' | 'credentials' | 'missing';

interface ProcessStatusCardProps {
  project: Project;
  isAdmin?: boolean;
  onProjectUpdate?: (project: Project) => void;
  onTestConnection?: () => void;
  testLoading?: boolean;
  credentials?: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

const getProgress = (project: Project) => {
  const items: TerraformStatus[] = [project.terraformState.bdcTf];
  if (project.cloudProvider === 'AWS' && project.terraformState.serviceTf) {
    items.unshift(project.terraformState.serviceTf);
  }
  const completed = items.filter(s => s === 'COMPLETED').length;
  return { completed, total: items.length };
};

const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '승인 대기' },
  { step: ProcessStatus.INSTALLING, label: '설치 진행' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '연결 확인' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

const getStepGuideText = (status: ProcessStatus) => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return '연결할 리소스를 선택하고 연동 대상을 확정하세요';
    case ProcessStatus.WAITING_APPROVAL:
      return '관리자 승인을 기다리는 중입니다';
    case ProcessStatus.INSTALLING:
      return 'PII Agent를 설치하고 있습니다';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '설치가 완료되었습니다. DB 연결을 테스트하세요';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'PII Agent 연결이 확인되었습니다. 관리자의 최종 확정을 기다리는 중입니다.';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'PII Agent 연동이 완료되었습니다.';
    default:
      return '';
  }
};

export const ProcessStatusCard = ({ project, isAdmin, onProjectUpdate, onTestConnection, testLoading, credentials = [], onCredentialChange }: ProcessStatusCardProps) => {
  const [showTerraformModal, setShowTerraformModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConnectionDetailModal, setShowConnectionDetailModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ConnectionTestHistory | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connectionTab, setConnectionTab] = useState<ConnectionTabType>('history');

  const currentStep = project.processStatus;
  const guideText = getStepGuideText(currentStep);
  const progress = getProgress(project);

  // 최신 테스트 결과
  const latestHistory = project.connectionTestHistory?.[0];

  // 마지막으로 성공한 테스트 기록
  const lastSuccessHistory = project.connectionTestHistory?.find(h => h.status === 'SUCCESS');

  // Credential 미설정 리소스
  const selectedResources = project.resources.filter((r) => r.isSelected);
  const missingCredentialResources = selectedResources.filter(
    (r) => needsCredential(r.databaseType) && !r.selectedCredentialId
  );

  // 미설정 리소스가 없어지면 History 탭으로 전환
  useEffect(() => {
    if (missingCredentialResources.length === 0 && connectionTab === 'missing') {
      setConnectionTab('history');
    }
  }, [missingCredentialResources.length, connectionTab]);

  // Test Connection 클릭 핸들러
  const handleTestConnectionClick = () => {
    if (missingCredentialResources.length > 0) {
      // 미설정 리소스가 있으면 탭 전환
      setConnectionTab('missing');
    } else {
      // 없으면 실제 테스트 실행
      onTestConnection?.();
    }
  };

  const handleShowLatestResult = () => {
    if (latestHistory) {
      setSelectedHistory(latestHistory);
      setShowConnectionDetailModal(true);
    }
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      const updated = await approveProject(project.id, approveComment);
      onProjectUpdate?.(updated);
      setShowApproveModal(false);
      setApproveComment('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      const updated = await rejectProject(project.id, rejectReason);
      onProjectUpdate?.(updated);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '반려에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        프로세스 진행 상태
      </h3>

      {/* Compact Step Indicator */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((item, index) => {
          const isCompleted = currentStep > item.step;
          const isCurrent = currentStep === item.step;
          const isLast = index === steps.length - 1;

          return (
            <div key={item.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    item.step
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs text-center max-w-[70px] leading-tight ${
                    isCompleted
                      ? 'text-green-600 font-medium'
                      : isCurrent
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 mx-1 mt-[-20px]">
                  <div
                    className={`h-0.5 rounded-full ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-4" />

      {/* Current Step Guide - 4단계는 CTA에 통합되므로 제외 */}
      <div className="flex-1 flex flex-col">
        {currentStep !== ProcessStatus.WAITING_CONNECTION_TEST && (
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              currentStep === ProcessStatus.INSTALLATION_COMPLETE
                ? 'bg-green-100'
                : currentStep === ProcessStatus.INSTALLING
                ? 'bg-orange-100'
                : 'bg-blue-100'
            }`}>
              {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : currentStep === ProcessStatus.INSTALLING ? (
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>
            <div>
              <p className={`font-medium ${
                currentStep === ProcessStatus.INSTALLATION_COMPLETE
                  ? 'text-green-700'
                  : 'text-gray-900'
              }`}>
                {guideText}
              </p>
              {currentStep === ProcessStatus.INSTALLING && (
                <p className="text-sm text-gray-500 mt-1">
                  설치가 완료되면 자동으로 다음 단계로 진행됩니다.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons Placeholder */}
        <div className="mt-auto pt-4">
          {currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
            <button
              disabled
              className="w-full px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
            >
              PII Agent 연동 대상 확정 (Phase 3)
            </button>
          )}
          {currentStep === ProcessStatus.WAITING_APPROVAL && (
            <div className="flex gap-2">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors"
                  >
                    반려
                  </button>
                </>
              ) : (
                <div className="w-full text-center py-2.5 text-gray-500 text-sm">
                  관리자 승인을 기다리는 중입니다
                </div>
              )}
            </div>
          )}
          {currentStep === ProcessStatus.INSTALLING && (
            <button
              onClick={() => setShowTerraformModal(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-medium text-orange-600">설치 상태 확인</span>
              </div>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-500 text-sm font-medium rounded-full">
                {progress.completed}/{progress.total}
              </span>
            </button>
          )}
          {(currentStep === ProcessStatus.WAITING_CONNECTION_TEST ||
            currentStep === ProcessStatus.CONNECTION_VERIFIED ||
            currentStep === ProcessStatus.INSTALLATION_COMPLETE) && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 헤더: 상태 + 버튼 */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                {lastSuccessHistory ? (
                  <button
                    onClick={() => {
                      setSelectedHistory(lastSuccessHistory);
                      setShowConnectionDetailModal(true);
                    }}
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
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {testLoading && (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
                      </svg>
                    )}
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
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                      : 'text-gray-500 hover:text-gray-700 bg-gray-50'
                  }`}
                >
                  DB 연결 History
                </button>
                <button
                  onClick={() => setConnectionTab('credentials')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    connectionTab === 'credentials'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
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
                  <ConnectionHistoryTab history={project.connectionTestHistory || []} />
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

              {/* 관리자 설치 완료 확정 버튼 (5단계: CONNECTION_VERIFIED) */}
              {currentStep === ProcessStatus.CONNECTION_VERIFIED && isAdmin && (
                <div className="px-4 py-3 bg-green-50 border-t border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-green-700">연결 테스트가 완료되었습니다</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          const updated = await confirmCompletion(project.id);
                          onProjectUpdate?.(updated);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : '설치 완료 확정에 실패했습니다.');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {submitting && (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
                        </svg>
                      )}
                      설치 완료 확정
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Terraform Status Modal */}
      {showTerraformModal && (
        <TerraformStatusModal
          terraformState={project.terraformState}
          cloudProvider={project.cloudProvider}
          onClose={() => setShowTerraformModal(false)}
        />
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">승인</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                승인 코멘트 (선택)
              </label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="승인 코멘트를 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApproveComment('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
                  </svg>
                )}
                승인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Detail Modal */}
      {showConnectionDetailModal && selectedHistory && (
        <ConnectionDetailModal
          history={selectedHistory}
          onClose={() => {
            setShowConnectionDetailModal(false);
            setSelectedHistory(null);
          }}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">반려</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                반려 사유
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력하세요..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
                  </svg>
                )}
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Credential 미설정 리소스 탭
interface MissingCredentialsTabProps {
  resources: import('../../../lib/types').Resource[];
  credentials: DBCredential[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
}

const MissingCredentialsTab = ({ resources, credentials, onCredentialChange }: MissingCredentialsTabProps) => {
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

// AWS 서비스 아이콘
const AwsServiceIcon = ({ type }: { type: AwsResourceType }) => {
  const icons: Record<AwsResourceType, React.ReactNode> = {
    RDS: (
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="#5294CF" />
        <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#1A476F" />
      </svg>
    ),
    RDS_CLUSTER: (
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M20 6c-6 0-11 2.2-11 5v18c0 2.8 5 5 11 5s11-2.2 11-5V11c0-2.8-5-5-11-5z" fill="#5294CF" />
        <ellipse cx="20" cy="11" rx="11" ry="5" fill="#1A476F" />
        <circle cx="28" cy="28" r="6" fill="#FF9900" />
        <path d="M26 28h4M28 26v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    DYNAMODB: (
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#3B48CC" />
        <path d="M8 12l12-4 12 4v16l-12 4-12-4V12z" fill="#5294CF" />
        <ellipse cx="20" cy="12" rx="12" ry="4" fill="#2E73B8" />
      </svg>
    ),
    ATHENA: (
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#8C4FFF" />
        <path d="M20 8l10 6v12l-10 6-10-6V14l10-6z" fill="#B98AFF" />
      </svg>
    ),
    REDSHIFT: (
      <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="4" fill="#205B99" />
        <path d="M10 14h20v16H10V14z" fill="#5294CF" />
        <rect x="10" y="14" width="20" height="4" fill="#1A476F" />
      </svg>
    ),
  };
  return <>{icons[type] || null}</>;
};
