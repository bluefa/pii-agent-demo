'use client';

import { useState, useEffect, useCallback } from 'react';
import { statusColors, cn } from '@/lib/theme';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { Modal } from '@/app/components/ui/Modal';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
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

const getServiceResourceDisplayLabel = (scriptStatus: 'PENDING' | 'INSTALLING' | 'COMPLETED' | 'FAILED') =>
  scriptStatus === 'COMPLETED' ? '설치 완료' : '설치 확인중';

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
  const [showScriptGuide, setShowScriptGuide] = useState(false);
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
  const resourceRows = status.serviceScripts.flatMap(script =>
    script.resources.map(resource => ({
      key: `${script.scriptId ?? script.scriptName}-${resource.resourceId}`,
      scriptLabel: script.scriptName,
      scriptStatus: script.status,
      resourceName: resource.name,
    })),
  );

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
        onClose={detailModal.close}
        title={detailModal.data === 'SERVICE' ? '서비스 측 Terraform 스크립트 설치 상세' : 'BDC 측 리소스 설치 상세'}
        size="lg"
      >
        {detailModal.data === 'SERVICE' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              상태 코드: <span className="font-medium">COMPLETED / INSTALLING / FAILED / PENDING</span>
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-2.5">Terraform Script</th>
                    <th className="px-4 py-2.5">상태 코드</th>
                    <th className="px-4 py-2.5">리소스 수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {status.serviceScripts.map(script => (
                    <tr key={script.scriptId ?? script.scriptName}>
                      <td className="px-4 py-2.5 text-sm text-gray-800">{script.scriptName}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{script.status}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{script.resourceCount ?? script.resources.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-2.5">Script</th>
                    <th className="px-4 py-2.5">Resource</th>
                    <th className="px-4 py-2.5">설치 상태</th>
                    <th className="px-4 py-2.5">조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resourceRows.map(row => {
                    const displayStatus = getServiceResourceDisplayLabel(row.scriptStatus);
                    const isCompleted = row.scriptStatus === 'COMPLETED';

                    return (
                      <tr key={row.key}>
                        <td className="px-4 py-2.5 text-sm text-gray-800">{row.scriptLabel}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-800">{row.resourceName}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            isCompleted ? statusColors.success.bg : statusColors.pending.bg,
                            isCompleted ? statusColors.success.textDark : statusColors.pending.textDark
                          )}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {isCompleted ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <button
                              onClick={() => setShowScriptGuide(true)}
                              className={cn('text-sm font-medium hover:underline', statusColors.warning.textDark)}
                            >
                              설치 가이드
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      {showScriptGuide && <TfScriptGuideModal onClose={() => setShowScriptGuide(false)} />}
    </div>
  );
};
