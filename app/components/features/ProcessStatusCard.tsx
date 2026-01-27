'use client';

import { useState, useEffect } from 'react';
import { ProcessStatus, Project, TerraformStatus, ConnectionTestHistory, DBCredential, needsCredential, AwsResourceType } from '../../../lib/types';
import { TerraformStatusModal } from './TerraformStatusModal';
import { ConnectionDetailModal } from './ConnectionDetailModal';
import { ConnectionHistoryTab } from './ConnectionHistoryTab';
import { CredentialListTab } from './CredentialListTab';
import { DatabaseIcon, getDatabaseLabel } from '../ui/DatabaseIcon';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AwsServiceIcon } from '../ui/AwsServiceIcon';
import { approveProject, rejectProject } from '../../lib/api';
import { useModal } from '../../hooks/useModal';
import { useApiMutation } from '../../hooks/useApiMutation';

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
  // Modal states
  const terraformModal = useModal();
  const approveModal = useModal();
  const rejectModal = useModal();
  const connectionDetailModal = useModal<ConnectionTestHistory>();

  // Form states
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [connectionTab, setConnectionTab] = useState<ConnectionTabType>('history');

  // API mutations
  const { mutate: doApprove, loading: approving } = useApiMutation(
    (comment: string) => approveProject(project.id, comment),
    {
      onSuccess: (updated) => {
        onProjectUpdate?.(updated);
        approveModal.close();
        setApproveComment('');
      },
      errorMessage: '승인에 실패했습니다.',
    }
  );

  const { mutate: doReject, loading: rejecting } = useApiMutation(
    (reason: string) => rejectProject(project.id, reason),
    {
      onSuccess: (updated) => {
        onProjectUpdate?.(updated);
        rejectModal.close();
        setRejectReason('');
      },
      errorMessage: '반려에 실패했습니다.',
    }
  );

  const submitting = approving || rejecting;

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
      connectionDetailModal.open(latestHistory);
    }
  };

  const handleApprove = () => doApprove(approveComment);
  const handleReject = () => doReject(rejectReason);

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
                    onClick={() => approveModal.open()}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => rejectModal.open()}
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
              onClick={() => terraformModal.open()}
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
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

            </div>
          )}
        </div>
      </div>

      {/* Terraform Status Modal */}
      {terraformModal.isOpen && (
        <TerraformStatusModal
          terraformState={project.terraformState}
          cloudProvider={project.cloudProvider}
          onClose={() => terraformModal.close()}
        />
      )}

      {/* Approve Modal */}
      {approveModal.isOpen && (
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
                  approveModal.close();
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
                {submitting && <LoadingSpinner />}
                승인하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Detail Modal */}
      {connectionDetailModal.data && (
        <ConnectionDetailModal
          history={connectionDetailModal.data}
          onClose={connectionDetailModal.close}
        />
      )}

      {/* Reject Modal */}
      {rejectModal.isOpen && (
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
                  rejectModal.close();
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
                {submitting && <LoadingSpinner />}
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

