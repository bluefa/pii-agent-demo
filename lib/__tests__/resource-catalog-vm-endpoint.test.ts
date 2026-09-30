// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { catalogToCandidates, type CatalogItem } from '@/lib/resource-catalog';

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'i-0a1b2c3d4e5f67890',
  resourceId: 'i-0a1b2c3d4e5f67890',
  name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
  resourceType: 'AWS_EC2_INSTANCE',
  databaseType: 'oracle',
  integrationCategory: 'NO_INSTALL_NEEDED',
  selected: false,
  exclusionReason: null,
  recommendFailReason: null,
  host: '10.10.1.24',
  port: 1522,
  oracleServiceId: 'ORCL',
  networkInterfaceId: null,
  ipConfigurationName: null,
  scanStatus: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  metadata: { provider: 'AWS', resourceType: 'AWS_EC2_INSTANCE' },
  ...overrides,
});

const ORACLE_ENDPOINT = {
  databaseType: 'ORACLE',
  host: '10.10.1.24',
  port: 1522,
  oracleServiceId: 'ORCL',
};

/**
 * The contract spells a VM `AWS_EC2_INSTANCE` / `AZURE_VIRTUAL_MACHINE` and sends the engine
 * lowercase. The hydration matched the mock's internal spellings only, so a row that came
 * back to step 1 with a declared endpoint lost it, and the retry request went out without
 * host, port and SID.
 */
describe('catalogToCandidates — VM endpoint hydration', () => {
  it.each(['AWS_EC2_INSTANCE', 'EC2', 'AZURE_VIRTUAL_MACHINE', 'AZURE_VM'])(
    'restores the declared endpoint for %s',
    (resourceType) => {
      const [candidate] = catalogToCandidates([item({ resourceType })]);
      expect(candidate.behaviorKey).toBe('endpoint');
      expect(candidate.endpointConfig).toEqual(ORACLE_ENDPOINT);
    },
  );

  // The form offers every engine in the VM catalog — one it can submit, it must read back.
  it('restores an engine outside the old five-engine list', () => {
    const [candidate] = catalogToCandidates([
      item({ databaseType: 'tibero', port: 8629, oracleServiceId: 'TBR' }),
    ]);
    expect(candidate.endpointConfig).toMatchObject({ databaseType: 'TIBERO', port: 8629 });
  });

  it('leaves a VM with no declared endpoint without a draft', () => {
    const [candidate] = catalogToCandidates([
      item({ databaseType: '', host: null, port: null, oracleServiceId: null }),
    ]);
    expect(candidate.behaviorKey).toBe('endpoint');
    expect(candidate.endpointConfig).toBeUndefined();
  });

  it('does not treat a managed database as a VM', () => {
    const [candidate] = catalogToCandidates([
      item({ resourceType: 'AWS_DB_INSTANCE', databaseType: 'mysql', port: 3306 }),
    ]);
    expect(candidate.behaviorKey).not.toBe('endpoint');
    expect(candidate.endpointConfig).toBeUndefined();
  });
});
