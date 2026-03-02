'use client';

import { useState, useEffect, useCallback } from 'react';
import { statusColors, cn, getButtonClass } from '@/lib/theme';
import { getAwsInstallationStatus, checkAwsInstallation } from '@/app/lib/api/aws';
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

const getScriptBadge = (scriptStatus: 'PENDING' | 'COMPLETED' | 'FAILED') => {
  if (scriptStatus === 'COMPLETED') {
    return {
      label: '설치 완료',
      colors: statusColors.success,
    };
  }

  return {
    label: '서비스 측 확인 필요',
    colors: statusColors.warning,
  };
};

const getResourceDisplayLabel = (status?: 'NOT_INSTALLED' | 'COMPLETED') =>
  status === 'COMPLETED' ? '설치 완료' : '설치 확인중';

export const AwsInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const [status, setStatus] = useState<AwsInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScriptGuide, setShowScriptGuide] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

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

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkAwsInstallation(targetSourceId);
      setStatus(data);
      if (isFullyCompleted(data)) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) return <InstallationLoadingView provider="AWS" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

  const actionSummary = getActionSummary(status);
  const serviceActionRequired = actionSummary.serviceActionRequired;
  const bdcInstallationRequired = actionSummary.bdcInstallationRequired;
  const selectedScript =
    status.serviceScripts.find(script =>
      script.scriptId ? script.scriptId === selectedScriptId : script.scriptName === selectedScriptId
    ) ??
    status.serviceScripts.find(script => script.status !== 'COMPLETED') ??
    status.serviceScripts[0];

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
        <div className={cn('rounded-lg border px-4 py-3', serviceActionRequired ? statusColors.warning.bg : statusColors.success.bg, serviceActionRequired ? statusColors.warning.border : statusColors.success.border)}>
          <p className={cn('text-xs', serviceActionRequired ? statusColors.warning.text : statusColors.success.text)}>
            서비스 담당자 조치
          </p>
          <p className={cn('mt-1 text-sm font-semibold', serviceActionRequired ? statusColors.warning.textDark : statusColors.success.textDark)}>
            {serviceActionRequired ? '필요' : '불필요'}
          </p>
        </div>

        <div className={cn('rounded-lg border px-4 py-3', bdcInstallationRequired ? statusColors.pending.bg : statusColors.success.bg, bdcInstallationRequired ? statusColors.pending.border : statusColors.success.border)}>
          <p className={cn('text-xs', bdcInstallationRequired ? statusColors.pending.text : statusColors.success.text)}>
            BDC 설치
          </p>
          <p className={cn('mt-1 text-sm font-semibold', bdcInstallationRequired ? statusColors.pending.textDark : statusColors.success.textDark)}>
            {bdcInstallationRequired ? '필요' : '불필요'}
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={getButtonClass('secondary', 'sm')}
        >
          {refreshing ? '확인 중...' : '상태 다시 확인'}
        </button>
      </div>

      {status.serviceScripts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h4 className="text-sm font-semibold text-gray-800">Service Terraform Scripts</h4>
            </div>
            <div className="p-2">
              {status.serviceScripts.map(script => {
                const scriptId = script.scriptId ?? script.scriptName;
                const isSelected = selectedScript?.scriptId === script.scriptId ||
                  (!selectedScript?.scriptId && selectedScript?.scriptName === script.scriptName);
                const badge = getScriptBadge(script.status);
                return (
                  <button
                    key={scriptId}
                    onClick={() => setSelectedScriptId(script.scriptId ?? script.scriptName)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                      isSelected ? 'border-gray-300 bg-gray-50' : 'border-transparent hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {script.terraformScriptName ?? script.scriptName}
                      </span>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', badge.colors.bg, badge.colors.textDark)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">리소스 {script.resourceCount ?? script.resources.length}개</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h4 className="text-sm font-semibold text-gray-800">
                {selectedScript ? `${selectedScript.terraformScriptName ?? selectedScript.scriptName} 리소스` : '리소스'}
              </h4>
            </div>

            {selectedScript ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-2.5">Resource</th>
                      <th className="px-4 py-2.5">설치 상태</th>
                      <th className="px-4 py-2.5">조치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedScript.resources.map(resource => {
                      const displayStatus = getResourceDisplayLabel(resource.installationDisplayStatus);
                      const isCompleted = resource.installationDisplayStatus === 'COMPLETED';
                      return (
                        <tr key={resource.resourceId}>
                          <td className="px-4 py-2.5 text-sm text-gray-800">{resource.name}</td>
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
