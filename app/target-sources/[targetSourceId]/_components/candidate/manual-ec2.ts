import type { Ec2Instance } from '@/app/lib/api/ec2';
import type { CandidateResource } from '@/lib/types/resources';

/** Wire resource type for an EC2 instance (RESOURCE_TYPE_ALIASES maps it to the internal `EC2`). */
export const EC2_INSTANCE_RESOURCE_TYPE = 'AWS_EC2_INSTANCE';

/** Connection info the config step collects for one instance. */
export interface Ec2ConnectionConfig {
  databaseType: string;
  port: number;
  /** Oracle-family engines only (Oracle · Tibero). */
  oracleServiceId?: string;
}

export const isManualEc2Candidate = (candidate: CandidateResource): boolean =>
  candidate.behaviorKey === 'manualEc2';

/**
 * A searched EC2 instance + its connection info → a Step-1 working-list row.
 *
 * The row is a `CandidateResource` like any other, so the table, the counts, the selection
 * and the approval payload all keep working with no special case beyond its behavior key.
 *
 * `integrationCategory` is NO_INSTALL_NEEDED — the same verdict the scan gives every EC2/VM
 * (they run things other than databases, so they are never a mandatory target). It also means
 * unchecking a manually added row needs no exclusion reason: the user is undoing their own
 * addition, and 삭제 is the action that fits.
 *
 * Connection info lives in `endpointConfig`, which the manualEc2 behavior turns into the
 * submitted metadata (host = private IP, database_type, port, oracle_service_id).
 */
export const toManualEc2Candidate = (
  instance: Ec2Instance,
  config: Ec2ConnectionConfig,
): CandidateResource => ({
  id: instance.instanceId,
  resourceId: instance.instanceId,
  resourceName: instance.privateDnsName,
  type: EC2_INSTANCE_RESOURCE_TYPE,
  // Left blank on purpose: the row does not show a Database Type column, and the wire value
  // comes from `endpointConfig` through the behavior — one owner for the field.
  databaseType: '',
  integrationCategory: 'NO_INSTALL_NEEDED',
  behaviorKey: 'manualEc2',
  selected: true,
  exclusionReason: null,
  recommendFailReason: null,
  endpointConfig: {
    databaseType: config.databaseType,
    port: config.port,
    host: instance.privateIpAddress,
    ...(config.oracleServiceId ? { oracleServiceId: config.oracleServiceId } : {}),
  },
  metadata: {
    provider: 'AWS',
    resourceType: EC2_INSTANCE_RESOURCE_TYPE,
    privateIp: instance.privateIpAddress,
    hostName: instance.privateDnsName,
  },
});
