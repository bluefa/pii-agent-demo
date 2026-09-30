import { describe, expect, it } from 'vitest';
import { catalogToCandidates, type CatalogItem } from '@/lib/resource-catalog';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { toApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import type { CandidateDraftState } from '@/lib/types/resources';

const NO_DRAFT: CandidateDraftState = { endpointDrafts: {}, rdsInstanceDrafts: {} };

const vm = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'i-0a1b2c3d4e5f67890',
  resourceId: 'i-0a1b2c3d4e5f67890',
  name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
  resourceType: 'AWS_EC2_INSTANCE',
  databaseType: 'mariadb',
  integrationCategory: 'NO_INSTALL_NEEDED',
  selected: true,
  exclusionReason: null,
  recommendFailReason: null,
  host: '10.10.1.24',
  port: 3306,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  scanStatus: null,
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
  metadata: { provider: 'AWS', resourceType: 'AWS_EC2_INSTANCE' },
  ...overrides,
});

const isConfigured = (item: CatalogItem): boolean => {
  const [candidate] = catalogToCandidates([item]);
  return getCandidateBehavior(candidate).isConfigured(candidate, NO_DRAFT);
};

/**
 * What the scan knows about a VM can be half an endpoint — an engine and a port with no
 * address. The editor refuses to save that; a row hydrated from it must not pass as
 * configured either, or the request goes out without the host the editor would have required.
 */
describe('endpoint behavior — isConfigured', () => {
  it('passes a complete endpoint', () => {
    expect(isConfigured(vm())).toBe(true);
  });

  it('holds a row that has no address', () => {
    expect(isConfigured(vm({ host: null }))).toBe(false);
  });

  // Azure VM: the address comes from the chosen NIC.
  it('passes a row whose address is a network interface', () => {
    expect(isConfigured(vm({
      resourceType: 'AZURE_VIRTUAL_MACHINE',
      host: null,
      networkInterfaceId: 'nic-1',
    }))).toBe(true);
  });

  it('keeps the half-filled values as the editor prefill', () => {
    const [candidate] = catalogToCandidates([vm({ host: null })]);
    expect(candidate.endpointConfig).toMatchObject({ databaseType: 'MARIADB', port: 3306 });
  });

  it('sends the restored engine lowercase, with its endpoint', () => {
    const candidates = catalogToCandidates([
      vm({ databaseType: 'tibero', port: 8629, oracleServiceId: 'TBR' }),
    ]);
    const input = toApprovalRequestInput(candidates, new Set([candidates[0].id]), NO_DRAFT, {});
    expect(input.resources?.[0]?.metadata).toMatchObject({
      database_type: 'tibero',
      host: '10.10.1.24',
      port: 8629,
      oracle_service_id: 'TBR',
    });
  });
});
