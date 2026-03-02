'use client';

import { useState, useEffect, useCallback } from 'react';
import { statusColors, cn } from '@/lib/theme';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { Modal } from '@/app/components/ui/Modal';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { useModal } from '@/app/hooks/useModal';
import type { AwsInstallationStatus } from '@/lib/types';

interface AwsInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

const getActionSummary = (status: AwsInstallationStatus) => {
  if (status.actionSummary) {
    return status.actionSummary;
  }

  return {
    serviceActionRequired: status.serviceScripts.some(script => script.status !== 'COMPLETED'),
    bdcInstallationRequired: status.bdcStatus.status !== 'COMPLETED',
  };
};

const isFullyCompleted = (status: AwsInstallationStatus): boolean => {
  const summary = getActionSummary(status);
  return !summary.serviceActionRequired && !summary.bdcInstallationRequired;
};

type ProgressDetailType = 'SERVICE' | 'BDC';

const getProgressStateColor = (state: 'completed' | 'current' | 'pending') => {
  if (state === 'completed') return cn(statusColors.success.dot, 'text-white');
  if (state === 'current') return cn(statusColors.info.dot, 'text-white');
  return cn(statusColors.pending.bg, statusColors.pending.text);
};

const getProgressTextColor = (state: 'completed' | 'current' | 'pending') => {
  if (state === 'completed') return statusColors.success.textDark;
  if (state === 'current') return statusColors.info.textDark;
  return statusColors.pending.textDark;
};

export const AwsInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const [status, setStatus] = useState<AwsInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedScriptKey, setExpandedScriptKey] = useState<string | null>(null);
  const detailModal = useModal<ProgressDetailType>();

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAwsInstallationStatus(targetSourceId);
      setStatus(data);
      if (isFullyCompleted(data)) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [onInstallComplete, targetSourceId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) return <InstallationLoadingView provider="AWS" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

  const actionSummary = getActionSummary(status);
  const serviceActionRequired = actionSummary.serviceActionRequired;
  const serviceProgressState: 'completed' | 'current' | 'pending' = serviceActionRequired ? 'current' : 'completed';
  const bdcProgressState: 'completed' | 'current' | 'pending' = serviceActionRequired
    ? 'pending'
    : status.bdcStatus.status === 'COMPLETED'
      ? 'completed'
      : status.bdcStatus.status === 'INSTALLING'
        ? 'current'
        : 'pending';
  const serviceStatusLabel = serviceActionRequired ? '설치 확인중' : '설치 확인 완료';
  const bdcStatusLabel = serviceActionRequired
    ? '서비스 측 Terraform 설치 확인 필요'
    : status.bdcStatus.status === 'COMPLETED'
      ? '설치됨'
      : status.bdcStatus.status === 'INSTALLING'
        ? '설치중'
        : '설치안됨';

  return (
    <div className="w-full space-y-3">
      {status.serviceScripts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-gray-800">설치 Progress</h4>
          </div>
          <div className="space-y-1 p-2">
            <div className="rounded-lg border px-3 py-2">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    getProgressStateColor(serviceProgressState),
                  )}>
                    1
                  </span>
                  <span className="mt-1 h-6 w-px bg-gray-200" />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">서비스 측 Terraform 스크립트 설치</p>
                  <p className={cn(
                    'mt-0.5 text-xs',
                    getProgressTextColor(serviceProgressState),
                  )}>
                    {serviceStatusLabel}
                  </p>
                </div>

                <button
                  onClick={() => detailModal.open('SERVICE')}
                  className="ml-auto text-xs font-medium text-gray-600 hover:underline"
                >
                  상세보기
                </button>
              </div>
            </div>

            <div className="rounded-lg border px-3 py-2">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    getProgressStateColor(bdcProgressState),
                  )}>
                    2
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">BDC 측 리소스 설치</p>
                  <p className={cn(
                    'mt-0.5 text-xs',
                    getProgressTextColor(bdcProgressState),
                  )}>
                    {bdcStatusLabel}
                  </p>
                </div>

                <button
                  onClick={() => detailModal.open('BDC')}
                  className="ml-auto text-xs font-medium text-gray-600 hover:underline"
                >
                  상세보기
                </button>
              </div>
            </div>

            <p className="px-1 pt-1 text-xs text-gray-500">
              서비스 측 TF 스크립트 설치 확인 완료 후 BDC 측 설치 여부를 확인합니다.
            </p>
          </div>
        </div>
      )}

      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => {
          detailModal.close();
          setExpandedScriptKey(null);
        }}
        title={detailModal.data === 'SERVICE' ? '서비스 측 Terraform 스크립트 설치 상세' : 'BDC 측 리소스 설치 상세'}
        size="lg"
      >
        {detailModal.data === 'SERVICE' ? (
          <div className="space-y-2">
            {status.serviceScripts.map(script => {
              const scriptKey = `${script.scriptId ?? script.scriptName}`;
              const isExpanded = expandedScriptKey === scriptKey;

              return (
                <div key={scriptKey} className="rounded-lg border border-gray-200">
                  <button
                    onClick={() =>
                      setExpandedScriptKey(prev => (prev === scriptKey ? null : scriptKey))
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                      {script.scriptName}
                    </span>
                    <span className="text-sm text-gray-700">{script.status}</span>
                    <svg
                      className={cn('h-4 w-4 text-gray-500 transition-transform', isExpanded && 'rotate-180')}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3">
                      <p className="mb-2 text-xs text-gray-500">관련 리소스</p>
                      <ul className="space-y-1">
                        {script.resources.map(resource => (
                          <li
                            key={resource.resourceId}
                            className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                          >
                            {resource.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              상태 코드: <span className="font-medium">COMPLETED / INSTALLING / FAILED / PENDING</span>
            </p>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                <span className="text-gray-500">선행조건</span>
                <span className="text-gray-800">
                  {serviceActionRequired ? '서비스 측 Terraform 설치 확인 필요' : '충족'}
                </span>
                <span className="text-gray-500">상태 코드</span>
                <span className="text-gray-800">{serviceActionRequired ? 'PENDING' : status.bdcStatus.status}</span>
                <span className="text-gray-500">표시 상태</span>
                <span className="text-gray-800">{bdcStatusLabel}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
