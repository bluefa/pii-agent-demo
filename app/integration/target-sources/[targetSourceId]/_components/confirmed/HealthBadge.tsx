import { cn, statusColors } from '@/lib/theme';
import type { HealthStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';

interface HealthBadgeProps {
  status: HealthStatus;
}

/**
 * Step 7 health pill — Healthy (success) / Unhealthy (error).
 * Single visual source for both the card header aggregate badge and the
 * per-row Status column cell.
 */
export const HealthBadge = ({ status }: HealthBadgeProps) => {
  const palette = status === 'healthy' ? statusColors.success : statusColors.error;
  const label = status === 'healthy' ? 'Healthy' : 'Unhealthy';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium',
        palette.bg,
        palette.textDark,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
      {label}
    </span>
  );
};
