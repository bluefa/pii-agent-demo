'use client';

import { useState, useEffect, useCallback } from 'react';
import { statusColors, cn } from '@/lib/theme';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
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

const getServiceResourceDisplayLabel = (scriptStatus: 'PENDING' | 'COMPLETED' | 'FAILED') =>
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
  const bdcInstallationRequired = actionSummary.bdcInstallationRequired;
  const serviceProgressState: 'completed' | 'current' | 'pending' = serviceActionRequired ? 'current' : 'completed';
  const bdcProgressState: 'completed' | 'current' | 'pending' = serviceActionRequired
    ? 'pending'
    : bdcInstallationRequired
      ? 'current'
      : 'completed';
  const serviceStatusLabel = serviceActionRequired ? '설치 확인중' : '설치 확인 완료';
  const bdcStatusLabel = bdcInstallationRequired ? '설치안됨' : '설치됨';
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
        <div className="grid grid-cols-2 gap-3">
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
                </div>
              </div>

              <p className="px-1 pt-1 text-xs text-gray-500">
                서비스 측 TF 스크립트 설치 확인 완료 후 BDC 측 설치 여부를 확인합니다.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h4 className="text-sm font-semibold text-gray-800">
                서비스 측 TF 설치 대상 리소스
              </h4>
            </div>

            {resourceRows.length > 0 ? (
              <div className="overflow-x-auto">
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
                            )}
                            >
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
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500">표시할 리소스가 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {showScriptGuide && <TfScriptGuideModal onClose={() => setShowScriptGuide(false)} />}
    </div>
  );
};
