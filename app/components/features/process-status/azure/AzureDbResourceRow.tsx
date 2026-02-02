'use client';

import { AzureResourceStatus, PrivateEndpointStatus } from '@/lib/types/azure';
import { PRIVATE_ENDPOINT_STATUS_LABELS } from '@/lib/constants/azure';

interface AzureDbResourceRowProps {
  resource: AzureResourceStatus;
}

const getStatusStyle = (status: PrivateEndpointStatus) => {
  switch (status) {
    case 'APPROVED':
      return {
        dot: 'bg-green-500',
        badge: 'bg-green-100 text-green-700',
      };
    case 'PENDING_APPROVAL':
      return {
        dot: 'bg-orange-500',
        badge: 'bg-orange-100 text-orange-700',
      };
    case 'REJECTED':
      return {
        dot: 'bg-red-500',
        badge: 'bg-red-100 text-red-700',
      };
    case 'NOT_REQUESTED':
    default:
      return {
        dot: 'bg-gray-400',
        badge: 'bg-gray-100 text-gray-500',
      };
  }
};

export const AzureDbResourceRow = ({ resource }: AzureDbResourceRowProps) => {
  const peStatus = resource.privateEndpoint.status;
  const style = getStatusStyle(peStatus);

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
        <span className="text-sm font-medium text-gray-900 truncate">
          {resource.resourceName}
        </span>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${style.badge}`}>
        {PRIVATE_ENDPOINT_STATUS_LABELS[peStatus]}
      </span>
    </div>
  );
};
