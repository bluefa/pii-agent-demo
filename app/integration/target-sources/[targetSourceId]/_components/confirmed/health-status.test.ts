import { describe, expect, it } from 'vitest';
import type { ConfirmedResource } from '@/lib/types/resources';
import {
  aggregateHealth,
  deriveHealth,
} from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/health-status';

const makeResource = (
  overrides: Partial<ConfirmedResource> = {},
): ConfirmedResource => ({
  resourceId: 'res-1',
  type: 'RDS',
  databaseType: 'MYSQL',
  region: 'ap-northeast-2',
  resourceName: 'res-1',
  host: 'localhost',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  credentialId: 'cred-1',
  connectionStatus: 'CONNECTED',
  ...overrides,
});

describe('deriveHealth', () => {
  it('returns healthy for CONNECTED', () => {
    expect(deriveHealth(makeResource({ connectionStatus: 'CONNECTED' }))).toBe('healthy');
  });

  it('returns unhealthy for DISCONNECTED', () => {
    expect(deriveHealth(makeResource({ connectionStatus: 'DISCONNECTED' }))).toBe('unhealthy');
  });
});

describe('aggregateHealth', () => {
  it('returns healthy for an empty list (no failure → Healthy)', () => {
    expect(aggregateHealth([])).toBe('healthy');
  });

  it('returns healthy when every resource is CONNECTED', () => {
    const list: ConfirmedResource[] = [
      makeResource({ resourceId: 'r1', connectionStatus: 'CONNECTED' }),
      makeResource({ resourceId: 'r2', connectionStatus: 'CONNECTED' }),
    ];
    expect(aggregateHealth(list)).toBe('healthy');
  });

  it('returns unhealthy when any resource is DISCONNECTED', () => {
    const list: ConfirmedResource[] = [
      makeResource({ resourceId: 'r1', connectionStatus: 'CONNECTED' }),
      makeResource({ resourceId: 'r2', connectionStatus: 'DISCONNECTED' }),
    ];
    expect(aggregateHealth(list)).toBe('unhealthy');
  });

  it('returns unhealthy when all resources are DISCONNECTED', () => {
    const list: ConfirmedResource[] = [
      makeResource({ resourceId: 'r1', connectionStatus: 'DISCONNECTED' }),
      makeResource({ resourceId: 'r2', connectionStatus: 'DISCONNECTED' }),
    ];
    expect(aggregateHealth(list)).toBe('unhealthy');
  });
});
