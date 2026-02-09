'use client';

import { Badge, BadgeVariant } from '@/app/components/ui/Badge';
import { ScanUIState } from '@/app/hooks/useScanPolling';

interface ScanStatusBadgeProps {
  uiState: ScanUIState;
}

const UI_STATE_CONFIG: Record<ScanUIState, { variant: BadgeVariant; label: string }> = {
  IDLE: { variant: 'neutral', label: '미실행' },
  COOLDOWN: { variant: 'pending', label: '쿨다운' },
  IN_PROGRESS: { variant: 'warning', label: '스캔 중' },
  COMPLETED: { variant: 'success', label: '완료' },
  FAILED: { variant: 'error', label: '실패' },
};

export const ScanStatusBadge = ({ uiState }: ScanStatusBadgeProps) => {
  const config = UI_STATE_CONFIG[uiState];

  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
};

export default ScanStatusBadge;
