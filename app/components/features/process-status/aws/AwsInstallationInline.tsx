'use client';

import { useState, useEffect, useRef } from 'react';
import { statusColors, cn } from '@/lib/theme';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { Modal } from '@/app/components/ui/Modal';
import { Badge } from '@/app/components/ui/Badge';
import { AwsServiceIcon } from '@/app/components/ui/AwsServiceIcon';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { useModal } from '@/app/hooks/useModal';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import type { AwsInstallationStatus, AwsResourceType } from '@/lib/types';

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
type ScriptStatus = 'PENDING' | 'INSTALLING' | 'COMPLETED' | 'FAILED';

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

const AWS_RESOURCE_TYPES: AwsResourceType[] = ['RDS', 'RDS_CLUSTER', 'DOCUMENTDB', 'DYNAMODB', 'ATHENA', 'REDSHIFT', 'EC2'];

const isAwsResourceType = (value: string): value is AwsResourceType =>
  AWS_RESOURCE_TYPES.includes(value as AwsResourceType);

const getScriptStatusDotColor = (status: ScriptStatus) => {
  if (status === 'COMPLETED') return statusColors.success.dot;
  if (status === 'INSTALLING') return statusColors.info.dot;
  if (status === 'FAILED') return statusColors.error.dot;
  return statusColors.pending.dot;
};

const getScriptStatusFillColor = (status: ScriptStatus) => {
  if (status === 'COMPLETED') return statusColors.success.dot;
  if (status === 'INSTALLING') return statusColors.info.dot;
  if (status === 'FAILED') return statusColors.error.dot;
  return statusColors.pending.dot;
};

const getScriptStatusPercent = (status: ScriptStatus) => {
  if (status === 'COMPLETED') return 100;
  if (status === 'INSTALLING') return 60;
  if (status === 'FAILED') return 25;
  return 0;
};

const getResourceInstallLabel = (
  resourceStatus: 'NOT_INSTALLED' | 'COMPLETED' | undefined,
  scriptStatus: ScriptStatus
) => {
  if (resourceStatus === 'COMPLETED' || scriptStatus === 'COMPLETED') return '설치 완료';
  return '설치 확인중';
};

export const AwsInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const [expandedScriptKey, setExpandedScriptKey] = useState<string | null>(null);
  const detailModal = useModal<ProgressDetailType>();
  const completionNotifiedRef = useRef(false);

  useEffect(() => {
    completionNotifiedRef.current = false;
  }, [targetSourceId]);

  const { status, loading, error, fetchStatus } = useInstallationStatus<AwsInstallationStatus>({
    targetSourceId,
    getFn: getAwsInstallationStatus,
    isComplete: isFullyCompleted,
    onComplete: () => {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onInstallComplete?.();
      }
    },
  });

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
  const totalScripts = status.serviceScripts.length;
  const totalResources = status.serviceScripts.reduce((sum, script) => sum + script.resources.length, 0);
  const completedScripts = status.serviceScripts.filter(script => script.status === 'COMPLETED').length;
  const installingScripts = status.serviceScripts.filter(script => script.status === 'INSTALLING').length;
  const failedScripts = status.serviceScripts.filter(script => script.status === 'FAILED').length;
  const pendingScripts = totalScripts - completedScripts - installingScripts - failedScripts;
  const serviceProgressPercent = totalScripts > 0 ? Math.round((completedScripts / totalScripts) * 100) : 0;
  const overallProgressPercent = serviceActionRequired
    ? Math.round(serviceProgressPercent * 0.5)
    : status.bdcStatus.status === 'COMPLETED'
      ? 100
      : status.bdcStatus.status === 'INSTALLING'
        ? 75
        : 50;
  const bdcDetailMessage = serviceActionRequired
    ? '서비스 측 Terraform 스크립트 설치 확인 완료 후 진행됩니다.'
    : status.bdcStatus.status === 'COMPLETED'
      ? 'BDC 측 리소스 설치 반영이 완료되었습니다.'
      : status.bdcStatus.status === 'INSTALLING'
        ? 'BDC 측 리소스 설치가 진행 중입니다.'
        : 'BDC 측 리소스 설치가 아직 완료되지 않았습니다.';
  const nextActionMessage = serviceActionRequired
    ? '서비스 담당자가 Terraform 스크립트 설치 여부를 확인해야 합니다.'
    : status.bdcStatus.status === 'COMPLETED'
      ? '추가 조치가 필요하지 않습니다.'
      : 'BDC 측 리소스 설치 완료 여부를 확인해야 합니다.';

  return (
    <div className="w-full space-y-3">
      {status.serviceScripts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h4 className="text-sm font-semibold text-gray-800">설치 Progress</h4>
            <p className="mt-1 text-xs text-gray-500">서비스 측 Terraform 확인 이후 BDC 설치 상태를 판단합니다.</p>
          </div>

          <div className="px-4 pt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">서비스 스크립트</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{completedScripts}/{totalScripts} 완료</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">설치 대상 리소스</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{totalResources}개</p>
              </div>
              <div className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">BDC 설치 상태</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">{bdcStatusLabel}</p>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  overallProgressPercent === 100 ? statusColors.success.dot : statusColors.info.dot
                )}
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">전체 진행률 {overallProgressPercent}%</p>
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
                  <p className="mt-1 text-xs text-gray-500">
                    완료 {completedScripts}/{totalScripts}
                    {failedScripts > 0 && ` · 실패 ${failedScripts}`}
                    {installingScripts > 0 && ` · 설치중 ${installingScripts}`}
                    {pendingScripts > 0 && ` · 대기 ${pendingScripts}`}
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
                  <p className="mt-1 text-xs text-gray-500">{bdcDetailMessage}</p>
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
              조치 포인트: {nextActionMessage}
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
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success" size="sm">COMPLETED {completedScripts}</Badge>
                <Badge variant="info" size="sm">INSTALLING {installingScripts}</Badge>
                <Badge variant="pending" size="sm">PENDING {pendingScripts}</Badge>
                <Badge variant="error" size="sm">FAILED {failedScripts}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">스크립트를 눌러 하위 리소스를 확인하세요.</p>
            </div>

            {status.serviceScripts.map(script => {
              const scriptKey = `${script.scriptId ?? script.scriptName}`;
              const isExpanded = expandedScriptKey === scriptKey;
              const resourceCount = script.resourceCount ?? script.resources.length;
              const scriptStatusPercent = getScriptStatusPercent(script.status);

              return (
                <div key={scriptKey} className="rounded-lg border border-gray-200">
                  <button
                    onClick={() =>
                      setExpandedScriptKey(prev => (prev === scriptKey ? null : scriptKey))
                    }
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-wide text-gray-400">terraform_script_name</p>
                      <p className="truncate text-sm font-medium text-gray-800">{script.scriptName}</p>
                      <p className="mt-1 text-xs text-gray-500">{resourceCount}개 리소스</p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          getScriptStatusDotColor(script.status),
                          script.status === 'INSTALLING' && 'animate-pulse'
                        )}
                        title={script.status}
                      />
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                        <span
                          className={cn('block h-full rounded-full', getScriptStatusFillColor(script.status))}
                          style={{ width: `${scriptStatusPercent}%` }}
                        />
                      </span>
                    </div>
                    <svg
                      className={cn('mt-0.5 h-4 w-4 text-gray-500 transition-transform', isExpanded && 'rotate-180')}
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
                        {script.resources.map(resource => {
                          const resourceType = resource.resource_type ?? resource.type;
                          const resourceId = resource.resource_id ?? resource.resourceId;
                          const installLabel = getResourceInstallLabel(resource.installationDisplayStatus, script.status);

                          return (
                            <li
                              key={resource.resourceId}
                              className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white">
                                  {isAwsResourceType(resourceType) ? (
                                    <AwsServiceIcon type={resourceType} size="sm" />
                                  ) : (
                                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 3c4.4 0 8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6c0-1.7 3.6-3 8-3Zm0 2c-3.8 0-6 .9-6 1s2.2 1 6 1 6-.9 6-1-2.2-1-6-1Zm-6 9v4c0 .1 2.2 1 6 1s6-.9 6-1v-4c-1.5.7-3.8 1-6 1s-4.5-.3-6-1Z" />
                                    </svg>
                                  )}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="neutral" size="sm">resource_type</Badge>
                                    <span className="text-xs font-medium text-gray-700">{resourceType}</span>
                                    <Badge
                                      variant={installLabel === '설치 완료' ? 'success' : 'pending'}
                                      size="sm"
                                    >
                                      {installLabel}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 break-all text-xs text-gray-600">
                                    <span className="font-medium text-gray-500">resource_id</span>
                                    {' '}
                                    {resourceId}
                                  </p>
                                </div>
                              </div>
                            </li>
                          );
                        })}
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
