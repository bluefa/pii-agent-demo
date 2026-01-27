'use client';

import { ConnectionStatus } from '../../../../lib/types';
import { CONNECTION_STATUS_CONFIG } from '../../../../lib/constants/labels';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  hasCredentialError?: boolean;
}

export const ConnectionIndicator = ({ status, hasCredentialError }: ConnectionIndicatorProps) => {
  // Credential 미선택 에러가 있으면 빨간색 표시
  if (hasCredentialError) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg text-red-500">●</span>
        <span className="text-sm text-red-500">Credential 미선택</span>
      </div>
    );
  }

  const config = CONNECTION_STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`text-lg ${config.className}`}>{config.icon}</span>
      <span className="text-sm text-gray-600">{config.label}</span>
    </div>
  );
};
