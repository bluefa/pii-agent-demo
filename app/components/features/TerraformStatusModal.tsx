'use client';

import { TerraformState, TerraformStatus, FirewallStatus, CloudProvider } from '@/lib/types';

interface TerraformStatusModalProps {
  terraformState: TerraformState;
  cloudProvider: CloudProvider;
  onClose: () => void;
}

const getTerraformStatusStyle = (status: TerraformStatus) => {
  switch (status) {
    case 'COMPLETED':
      return { bg: 'bg-green-100', text: 'text-green-700', label: '완료' };
    case 'FAILED':
      return { bg: 'bg-red-100', text: 'text-red-700', label: '실패' };
    case 'PENDING':
      return { bg: 'bg-gray-100', text: 'text-gray-500', label: '대기' };
  }
};

const getFirewallStatusStyle = (status?: FirewallStatus) => {
  if (!status) return { bg: 'bg-gray-100', text: 'text-gray-500', label: '확인 전' };
  switch (status) {
    case 'CONNECTED':
      return { bg: 'bg-green-100', text: 'text-green-700', label: '연결됨' };
    case 'CONNECTION_FAIL':
      return { bg: 'bg-red-100', text: 'text-red-700', label: '연결 실패' };
  }
};

const StatusIcon = ({ status }: { status: 'completed' | 'failed' | 'pending' }) => {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        성공
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        실패
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      대기중
    </span>
  );
};

// Terraform 아이콘
const TerraformIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="currentColor">
    <path d="M22.4 0v19.2L39.2 28.8V9.6L22.4 0z" />
    <path d="M41.6 11.2v19.2l16.8-9.6V1.6L41.6 11.2z" />
    <path d="M5.6 11.2L22.4 20.8V40L5.6 30.4V11.2z" />
    <path d="M22.4 43.2v19.2L39.2 72V52.8L22.4 43.2z" />
  </svg>
);

// 방화벽 아이콘
const FirewallIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const StatusRow = ({
  label,
  status,
  statusLabel,
  icon,
}: {
  label: string;
  status: 'completed' | 'failed' | 'pending';
  statusLabel: string;
  icon: 'terraform' | 'firewall';
}) => {
  const style = status === 'completed'
    ? { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', iconBg: 'bg-green-100', iconColor: 'text-green-600' }
    : status === 'failed'
    ? { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600' }
    : { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-500', iconBg: 'bg-gray-100', iconColor: 'text-gray-400' };

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.iconBg}`}>
          {icon === 'terraform' ? (
            <TerraformIcon className={`w-6 h-6 ${style.iconColor}`} />
          ) : (
            <FirewallIcon className={`w-6 h-6 ${style.iconColor}`} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{label}</span>
          <StatusIcon status={status} />
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${style.badge}`}>
        {statusLabel}
      </span>
    </div>
  );
};

export const TerraformStatusModal = ({
  terraformState,
  cloudProvider,
  onClose,
}: TerraformStatusModalProps) => {
  const mapStatus = (s: TerraformStatus): 'completed' | 'failed' | 'pending' => {
    if (s === 'COMPLETED') return 'completed';
    if (s === 'FAILED') return 'failed';
    return 'pending';
  };

  const mapFirewallStatus = (s?: FirewallStatus): 'completed' | 'failed' | 'pending' => {
    if (!s) return 'pending';
    if (s === 'CONNECTED') return 'completed';
    return 'failed';
  };

  // 진행률 계산
  const getProgress = () => {
    const items: TerraformStatus[] = [terraformState.bdcTf];
    if (cloudProvider === 'AWS' && terraformState.serviceTf) {
      items.unshift(terraformState.serviceTf);
    }
    const completed = items.filter(s => s === 'COMPLETED').length;
    return { completed, total: items.length };
  };

  const progress = getProgress();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">설치 진행 상태</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {cloudProvider === 'AWS' && terraformState.serviceTf && (
            <StatusRow
              icon="terraform"
              label="Service Terraform"
              status={mapStatus(terraformState.serviceTf)}
              statusLabel={getTerraformStatusStyle(terraformState.serviceTf).label}
            />
          )}

          <StatusRow
            icon="terraform"
            label="BDC Terraform"
            status={mapStatus(terraformState.bdcTf)}
            statusLabel={getTerraformStatusStyle(terraformState.bdcTf).label}
          />

          {cloudProvider === 'IDC' && (
            <StatusRow
              icon="firewall"
              label="방화벽 연결"
              status={mapFirewallStatus(terraformState.firewallCheck)}
              statusLabel={getFirewallStatusStyle(terraformState.firewallCheck).label}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {progress.completed === progress.total
                ? '모든 설치가 완료되었습니다.'
                : '설치가 완료되면 자동으로 다음 단계로 진행됩니다.'}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
