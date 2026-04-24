import { Resource } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType } from '@/lib/types/idc';
import { ConnectionTestPanel } from '@/app/components/features/process-status/ConnectionTestPanel';
import { statusColors, cn } from '@/lib/theme';
import { FirewallGuide } from './FirewallGuide';

interface IdcInstallationStatusDisplayProps {
  status: IdcInstallationStatusType;
  resources: Resource[];
  targetSourceId: number;
  onRetry: () => void;
  onResourceUpdate?: () => void;
}

export const IdcInstallationStatusDisplay = ({
  status,
  resources,
  targetSourceId,
  onRetry,
  onResourceUpdate,
}: IdcInstallationStatusDisplayProps) => {
  const isBdcCompleted = status.bdcTf === 'COMPLETED';
  const isBdcFailed = status.bdcTf === 'FAILED';
  const isBdcInProgress = status.bdcTf === 'IN_PROGRESS';

  return (
    <div className="space-y-3">
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-lg',
        isBdcCompleted ? 'bg-green-50' : isBdcFailed ? 'bg-red-50' : statusColors.info.bgLight,
      )}>
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isBdcCompleted ? 'bg-green-500' : isBdcFailed ? 'bg-red-500' : statusColors.info.dot,
        )}>
          {isBdcCompleted ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : isBdcFailed ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <span className={cn(
          'text-sm font-medium',
          isBdcCompleted ? 'text-green-700' : isBdcFailed ? 'text-red-700' : statusColors.info.textDark,
        )}>
          BDC 환경 구성 {isBdcCompleted ? '완료' : isBdcFailed ? '실패' : isBdcInProgress ? '진행 중' : '대기 중'}
        </span>
        {isBdcFailed && (
          <button
            onClick={onRetry}
            className="ml-auto text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            재시도
          </button>
        )}
      </div>

      {/* 방화벽 미확인 시 항상 노출 — BDC 진행 중에도 사전 결재 가능. */}
      {!status.firewallOpened && (
        <FirewallGuide resources={resources} />
      )}

      {isBdcCompleted && status.firewallOpened && (
        <ConnectionTestPanel
          targetSourceId={targetSourceId}
          selectedResources={resources.filter((r) => r.isSelected)}
          onResourceUpdate={onResourceUpdate}
        />
      )}
    </div>
  );
};
