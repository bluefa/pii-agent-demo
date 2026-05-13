import { cn, statusColors } from '@/lib/theme';
import { ProcessStatus } from '@/lib/types';

export type HealthStatus = 'HEALTHY' | 'PARTIAL' | 'UNHEALTHY' | 'PENDING' | 'OPERATIONAL';

const PILL_BY_STATUS: Record<HealthStatus, { tone: keyof typeof statusColors; label: string }> = {
  HEALTHY: { tone: 'success', label: 'Healthy' },
  PARTIAL: { tone: 'warning', label: 'Partial' },
  UNHEALTHY: { tone: 'error', label: 'Unhealthy' },
  PENDING: { tone: 'pending', label: '연동 대기' },
  OPERATIONAL: { tone: 'info', label: '운영 중' },
};

// Spec §C: until BFF returns health_status, derive a coarse pill from
// process_status — installation workflow → "연동 대기", post-completion → "운영 중".
// Healthy/Partial/Unhealthy distinctions need §C and are not surfaced here.
export const deriveHealthFromProcessStatus = (processStatus: ProcessStatus): HealthStatus =>
  processStatus >= ProcessStatus.INSTALLATION_COMPLETE ? 'OPERATIONAL' : 'PENDING';

interface StatusPillV2Props {
  status: HealthStatus;
  className?: string;
}

export const StatusPillV2 = ({ status, className }: StatusPillV2Props) => {
  const { tone, label } = PILL_BY_STATUS[status];
  const palette = statusColors[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
        palette.bg,
        palette.textDark,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', palette.dot)} />
      {label}
    </span>
  );
};
