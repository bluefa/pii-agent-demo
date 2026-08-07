// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { catalogToCandidates, type CatalogItem } from '@/lib/resource-catalog';
import type { RdsInstanceCandidate } from '@/lib/rds-instances';

const CANDIDATES: RdsInstanceCandidate[] = [
  { resource_id: 'arn:db:demo-1', resource_name: 'demo-1', cluster_member_role: 'WRITER' },
  { resource_id: 'arn:db:demo-2', resource_name: 'demo-2', cluster_member_role: 'READER' },
];

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: 'res-1',
  resourceId: 'arn:aws:rds:ap-northeast-2:acct:cluster:demo',
  name: 'demo-cluster',
  resourceType: 'AWS_DB_CLUSTER',
  databaseType: 'MYSQL',
  integrationCategory: 'TARGET',
  selected: true,
  exclusionReason: null,
  recommendFailReason: null,
  host: null,
  port: null,
  oracleServiceId: null,
  networkInterfaceId: null,
  ipConfigurationName: null,
  scanStatus: null,
  rdsInstanceCandidates: CANDIDATES,
  selectedRdsInstanceResourceId: 'arn:db:demo-2',
  metadata: { provider: 'AWS', resourceType: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  ...overrides,
});

// `CandidateResource` documents the cluster fields as cluster-only, and the approval payload
// echoes whatever reaches them. The TYPE has to gate that, not the presence of the array —
// the same rule `readRdsInstanceMetadata` applies on the read-only approval surfaces.
describe('catalogToCandidates — RDS cluster gate', () => {
  it('carries the candidates and the chosen id for a real cluster', () => {
    const [candidate] = catalogToCandidates([item()]);
    expect(candidate.behaviorKey).toBe('rdsInstance');
    expect(candidate.rdsInstanceCandidates).toEqual(CANDIDATES);
    expect(candidate.selectedRdsInstanceResourceId).toBe('arn:db:demo-2');
  });

  it('drops both fields when the type is not a cluster, however the array got there', () => {
    const [candidate] = catalogToCandidates([item({ resourceType: 'AWS_RDS_GLOBAL_CLUSTER' })]);
    expect(candidate.rdsInstanceCandidates).toBeUndefined();
    expect(candidate.selectedRdsInstanceResourceId).toBeUndefined();
    expect(candidate.behaviorKey).not.toBe('rdsInstance');
  });

  it('leaves a cluster with no candidates as a flat row', () => {
    const [candidate] = catalogToCandidates([
      item({ rdsInstanceCandidates: [], selectedRdsInstanceResourceId: null }),
    ]);
    expect(candidate.rdsInstanceCandidates).toBeUndefined();
    expect(candidate.behaviorKey).not.toBe('rdsInstance');
  });
});
