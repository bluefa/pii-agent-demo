import type { ConfirmedResource } from '@/lib/types/resources';

/**
 * Per-DB health status — derived from connectionStatus.
 *
 * The BFF does not yet expose a dedicated healthStatus field. This helper
 * is the single derive point. When the BFF schema gains a healthStatus,
 * replace the body of this function and the column shape stays.
 */
export type HealthStatus = 'healthy' | 'unhealthy';

export const deriveHealth = (resource: ConfirmedResource): HealthStatus =>
  resource.connectionStatus === 'CONNECTED' ? 'healthy' : 'unhealthy';

export const aggregateHealth = (resources: readonly ConfirmedResource[]): HealthStatus => {
  if (resources.length === 0) return 'healthy'; // empty list → no failure → Healthy
  return resources.every((r) => deriveHealth(r) === 'healthy') ? 'healthy' : 'unhealthy';
};
