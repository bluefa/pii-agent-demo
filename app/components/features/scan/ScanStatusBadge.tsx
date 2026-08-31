'use client';

import { Badge, BadgeVariant } from '@/app/components/ui/Badge';
import { useLocale } from '@/app/components/LocaleProvider';
import { SCAN_COPY, type ScanCopy } from '@/app/components/features/scan/copy';
import { ScanUIState } from '@/app/hooks/useScanPolling';

interface ScanStatusBadgeProps {
  uiState: ScanUIState;
}

const uiStateConfig = (
  t: ScanCopy,
): Record<ScanUIState, { variant: BadgeVariant; label: string }> => ({
  IDLE: { variant: 'neutral', label: t.badgeIdle },
  IN_PROGRESS: { variant: 'warning', label: t.badgeInProgress },
  COMPLETED: { variant: 'success', label: t.badgeCompleted },
  FAILED: { variant: 'error', label: t.statusFail },
});

export const ScanStatusBadge = ({ uiState }: ScanStatusBadgeProps) => {
  const { locale } = useLocale();
  const config = uiStateConfig(SCAN_COPY[locale])[uiState];

  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  );
};

export default ScanStatusBadge;
