'use client';

import { useState, useEffect } from 'react';
import { statusColors, cn } from '@/lib/theme';
import { getAwsInstallationStatus, checkAwsInstallation } from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { ActionCard } from '@/app/components/features/process-status/shared/ActionCard';
import { AwsInstallModeCard } from '@/app/components/features/process-status/aws/AwsInstallModeCard';
import { TfRoleGuideModal } from '@/app/components/features/process-status/aws/TfRoleGuideModal';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
import type { AwsInstallationStatus } from '@/lib/types';

interface AwsInstallationInlineProps {
  projectId: string;
  onInstallComplete?: () => void;
}

type InstallState = 'completed' | 'in_progress' | 'pending' | 'preparing';

const getInstallState = (status: AwsInstallationStatus): InstallState => {
  if (status.serviceTfCompleted && status.bdcTfCompleted) return 'completed';
  if (status.serviceTfCompleted || (status.hasTfPermission && !status.serviceTfCompleted)) return 'in_progress';
  if (!status.hasTfPermission && !status.serviceTfCompleted) return 'pending';
  return 'preparing';
};

const getProgressPercent = (status: AwsInstallationStatus): number => {
  if (status.serviceTfCompleted && status.bdcTfCompleted) return 100;
  if (status.serviceTfCompleted) return 50;
  return 0;
};

const STATE_CONFIG = {
  completed: {
    colors: statusColors.success,
    label: 'AWS 에이전트 설치 완료',
    icon: '●',
  },
  in_progress: {
    colors: statusColors.warning,
    label: 'AWS 에이전트 설치 진행 중',
    icon: '◐',
  },
  pending: {
    colors: statusColors.pending,
    label: 'AWS 에이전트 설치 대기 중',
    icon: '○',
  },
  preparing: {
    colors: statusColors.warning,
    label: 'AWS 에이전트 설치 준비 중',
    icon: '◐',
  },
} as const;

const getReassuranceText = (status: AwsInstallationStatus, state: InstallState): string | null => {
  if (state === 'completed' || state === 'pending') return null;
  if (state === 'preparing') return '자동으로 설치가 진행될 예정입니다.';
  if (status.hasTfPermission) {
    return '자동으로 설치가 진행되고 있습니다.\nAWS 계정에 보안 연결 환경을 구성하고\n에이전트가 DB에 접근할 수 있도록 설정합니다.';
  }
  return '설치 스크립트가 실행되었습니다. 자동으로 완료됩니다.';
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

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAwsInstallationStatus(projectId);
      setStatus(data);
      if (data.serviceTfCompleted && data.bdcTfCompleted) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkAwsInstallation(projectId);
      setStatus(data);
      if (data.serviceTfCompleted && data.bdcTfCompleted) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadScript = () => {
    window.open(`/api/aws/projects/${projectId}/terraform-script`, '_blank');
  };

  useEffect(() => {
    fetchStatus();
  }, [projectId]);

  if (loading) return <InstallationLoadingView provider="AWS" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

  const state = getInstallState(status);
  const config = STATE_CONFIG[state];
  const percent = getProgressPercent(status);
  const reassurance = getReassuranceText(status, state);
  const isCompleted = state === 'completed';

  return (
    <div className="w-full space-y-3">
      {/* Main progress card */}
      <div className={cn('px-4 py-3 rounded-lg border', config.colors.bg, config.colors.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {state === 'in_progress' || state === 'preparing' ? (
              <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0', config.colors.border)} />
            ) : (
              <span className={cn('text-sm flex-shrink-0', config.colors.text)}>{config.icon}</span>
            )}
            <span className={cn('text-sm font-medium', config.colors.textDark)}>{config.label}</span>
          </div>
          {!isCompleted && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn('p-1 rounded transition-colors disabled:opacity-50 flex-shrink-0 ml-2', config.colors.textDark, 'hover:bg-white/50')}
              title="새로고침"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-white/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', config.colors.dot)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={cn('text-xs mt-1 block', config.colors.textDark)}>{percent}%</span>

        {reassurance && (
          <p className="mt-1.5 text-xs text-gray-500 whitespace-pre-line">{reassurance}</p>
        )}
      </div>

      {/* Install mode card (hidden when completed) */}
      {!isCompleted && (
        <AwsInstallModeCard
          isAutoMode={status.hasTfPermission}
          serviceTfCompleted={status.serviceTfCompleted}
          onShowRoleGuide={() => setShowRoleGuide(true)}
          onShowScriptGuide={() => setShowScriptGuide(true)}
          onDownloadScript={handleDownloadScript}
        />
      )}

      {/* Action card for manual mode before script execution */}
      {!status.hasTfPermission && !status.serviceTfCompleted && (
        <ActionCard title="조치 필요">
          <p className="text-sm text-gray-700 mb-3">
            설치 스크립트를 담당자와 함께 실행해주세요.
            스크립트는 AWS 계정에 보안 연결 환경을 구성하고
            에이전트 접근 설정을 수행합니다.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadScript}
              className={cn('inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors', statusColors.warning.dot, 'text-white hover:opacity-90')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              설치 스크립트 다운로드
            </button>
            <button
              onClick={() => setShowScriptGuide(true)}
              className={cn('text-sm hover:underline', statusColors.warning.textDark)}
            >
              설치 가이드 보기
            </button>
          </div>
        </ActionCard>
      )}

      {showRoleGuide && <TfRoleGuideModal onClose={() => setShowRoleGuide(false)} />}
      {showScriptGuide && <TfScriptGuideModal onClose={() => setShowScriptGuide(false)} />}
    </div>
  );
};
