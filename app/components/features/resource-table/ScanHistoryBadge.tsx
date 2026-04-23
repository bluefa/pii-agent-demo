import { Badge } from '@/app/components/ui/Badge';
import { cn, textColors } from '@/lib/theme';
import { getResourceScanHistory } from '@/lib/resource';
import type { Resource } from '@/lib/types';

interface ScanHistoryBadgeProps {
  resource: Resource;
}

export const ScanHistoryBadge = ({ resource }: ScanHistoryBadgeProps) => {
  const value = getResourceScanHistory(resource);
  if (value === '신규') return <Badge variant="info" size="sm">신규</Badge>;
  if (value === '변경') return <Badge variant="warning" size="sm">변경</Badge>;
  return <span className={cn('text-xs', textColors.quaternary)}>—</span>;
};
