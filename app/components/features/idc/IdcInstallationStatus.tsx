'use client';

import { IdcInstallationStatus as IdcInstallationStatusType, IdcTfStatus } from '@/lib/types/idc';
import { IDC_TF_STATUS_LABELS } from '@/lib/constants/idc';
import { statusColors, cn } from '@/lib/theme';

interface IdcInstallationStatusProps {
  status: IdcInstallationStatusType;
  onConfirmFirewall?: () => void;
  onRetry?: () => void;
  onTestConnection?: () => void;
}

const getStatusColor = (bdcTf: IdcTfStatus, firewallOpened: boolean) => {
  if (bdcTf === 'FAILED') return statusColors.error;
  if (bdcTf === 'IN_PROGRESS') return statusColors.warning;
  if (bdcTf === 'COMPLETED') {
    return firewallOpened ? statusColors.success : statusColors.warning;
  }
  return statusColors.pending;
};

const getStatusMessage = (bdcTf: IdcTfStatus, firewallOpened: boolean): string => {
  switch (bdcTf) {
    case 'PENDING':
      return '리소스 연결 환경 구성 대기';
    case 'IN_PROGRESS':
      return '리소스 연결 환경 구성 중...';
    case 'COMPLETED':
      return firewallOpened ? 'Test Connection 진행 가능' : '방화벽 확인 필요';
    case 'FAILED':
      return '환경 구성 실패';
    default:
      return '알 수 없는 상태';
  }
};

export const IdcInstallationStatus = ({
  status,
  onConfirmFirewall,
  onRetry,
  onTestConnection,
}: IdcInstallationStatusProps) => {
  const { bdcTf, firewallOpened, error } = status;
  const colors = getStatusColor(bdcTf, firewallOpened);
  const message = getStatusMessage(bdcTf, firewallOpened);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        IDC 설치 상태
      </h3>

      <div className={cn('rounded-lg p-4', colors.bg)}>
        <div className="flex items-center gap-3">
          {bdcTf === 'IN_PROGRESS' && (
            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          )}
          {bdcTf !== 'IN_PROGRESS' && (
            <div className={cn('w-3 h-3 rounded-full', colors.dot)} />
          )}
          <div className="flex-1">
            <p className={cn('font-medium', colors.textDark)}>{message}</p>
            <p className={cn('text-sm mt-0.5', colors.text)}>
              {IDC_TF_STATUS_LABELS[bdcTf]}
            </p>
          </div>
        </div>

        {error && bdcTf === 'FAILED' && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              <span className="font-medium">[{error.code}]</span> {error.message}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        {bdcTf === 'COMPLETED' && !firewallOpened && onConfirmFirewall && (
          <button
            onClick={onConfirmFirewall}
            className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            방화벽 확인 완료
          </button>
        )}

        {bdcTf === 'COMPLETED' && firewallOpened && onTestConnection && (
          <button
            onClick={onTestConnection}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Test Connection
          </button>
        )}

        {bdcTf === 'FAILED' && onRetry && (
          <button
            onClick={onRetry}
            className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            재시도
          </button>
        )}
      </div>
    </div>
  );
};
