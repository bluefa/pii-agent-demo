import { cn, idcStyles } from '@/lib/theme';
import type { HealthStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';

interface HealthBadgeProps {
  status: HealthStatus;
}

/**
 * Step 7 health status — bare `.status` primitive (text + dot, no bg/pad/radius).
 * Single visual source for both the card header aggregate badge and the
 * per-row Status column cell.
 */
export const HealthBadge = ({ status }: HealthBadgeProps) => {
  const variant = status === 'healthy' ? idcStyles.status.healthy : idcStyles.status.unhealthy;
  const label = status === 'healthy' ? 'Healthy' : 'Unhealthy';
  return (
    <span className={cn(idcStyles.status.base, variant.text)}>
      <span className={cn(idcStyles.status.dot, variant.dot)} />
      {label}
    </span>
  );
};
