'use client';

import { AzureResourceStatus, PrivateEndpointStatus } from '@/lib/types/azure';
import { PRIVATE_ENDPOINT_STATUS_LABELS } from '@/lib/constants/azure';

interface PrivateEndpointStatusRowProps {
  resource: AzureResourceStatus;
}

const getStatusStyle = (status: PrivateEndpointStatus) => {
  switch (status) {
    case 'APPROVED':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        badge: 'bg-green-100 text-green-700',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        icon: 'check',
      };
    case 'PENDING_APPROVAL':
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        badge: 'bg-orange-100 text-orange-700',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        icon: 'clock',
      };
    case 'REJECTED':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-700',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        icon: 'x',
      };
    case 'NOT_REQUESTED':
    default:
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        badge: 'bg-gray-100 text-gray-500',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-400',
        icon: 'pending',
      };
  }
};

const StatusIcon = ({ icon }: { icon: string }) => {
  if (icon === 'check') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (icon === 'clock') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (icon === 'x') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
  );
};

const isTfCompleted = (status: PrivateEndpointStatus): boolean => {
  return status !== 'NOT_REQUESTED';
};

export const PrivateEndpointStatusRow = ({ resource }: PrivateEndpointStatusRowProps) => {
  const peStatus = resource.privateEndpoint.status;
  const style = getStatusStyle(peStatus);
  const tfCompleted = isTfCompleted(peStatus);

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${style.iconBg}`}>
          <StatusIcon icon={style.icon} />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{resource.resourceName}</span>
          <span className="text-xs text-gray-500">
            {resource.resourceType} | TF {tfCompleted ? '완료' : '대기'}
          </span>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${style.badge}`}>
        {PRIVATE_ENDPOINT_STATUS_LABELS[peStatus]}
      </span>
    </div>
  );
};
