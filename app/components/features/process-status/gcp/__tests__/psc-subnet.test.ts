import { describe, expect, it } from 'vitest';
import {
  CIDR_PLACEHOLDER,
  pscSubnetTargets,
  regionAbbr,
} from '@/app/components/features/process-status/gcp/psc-subnet';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

const row = (
  region: string | null,
  extra: Partial<ConfirmedIntegrationResourceInfo> = {},
): ConfirmedIntegrationResourceInfo => ({
  resource_id: `projects/p/instances/${region}-${Math.random()}`,
  resource_type: 'GCP_SQL',
  database_type: null,
  database_region: region,
  resource_name: null,
  port: null,
  host: null,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  credential_id: null,
  host_project: 'acme-net-host-prod',
  host_network: 'shared-vpc-prod',
  ...extra,
});

describe('regionAbbr', () => {
  it('takes the first letter of each word plus the number', () => {
    expect(regionAbbr('asia-northeast3')).toBe('an3');
    expect(regionAbbr('europe-west2')).toBe('ew2');
    expect(regionAbbr('us-central1')).toBe('uc1');
    expect(regionAbbr('northamerica-northeast1')).toBe('nn1');
  });
});

describe('pscSubnetTargets', () => {
  it('groups rows into one subnet per (host network, region) — never per resource', () => {
    const targets = pscSubnetTargets([
      row('asia-northeast3'),
      row('asia-northeast3'),
      row('europe-west2'),
    ]);
    expect(targets.map((t) => [t.region, t.subnetName, t.resourceCount])).toEqual([
      ['asia-northeast3', 'pii-agent-proxy-subnet-an3', 2],
      ['europe-west2', 'pii-agent-proxy-subnet-ew2', 1],
    ]);
  });

  it('splits the same region across two host networks', () => {
    const targets = pscSubnetTargets([
      row('asia-northeast3'),
      row('asia-northeast3', { host_network: 'shared-vpc-dev' }),
    ]);
    expect(targets).toHaveLength(2);
  });

  it('skips a row missing any of the three facts instead of guessing', () => {
    expect(pscSubnetTargets([row('asia-northeast3', { host_project: null })])).toEqual([]);
    expect(pscSubnetTargets([row('asia-northeast3', { host_network: '' })])).toEqual([]);
    expect(pscSubnetTargets([row(null)])).toEqual([]);
  });

  it('ignores BigQuery rows — PSC, and so the proxy subnet, is Cloud SQL only', () => {
    expect(pscSubnetTargets([{ ...row('asia-northeast3'), resource_type: 'GCP_BIGQUERY_DATASET_REGION' }])).toEqual([]);
  });

  it('fills everything but the CIDR into the command', () => {
    const [target] = pscSubnetTargets([row('asia-northeast3')]);
    expect(target.command).toContain('subnets create pii-agent-proxy-subnet-an3 \\');
    expect(target.command).toContain('--project=acme-net-host-prod \\');
    expect(target.command).toContain('--network=shared-vpc-prod \\');
    expect(target.command).toContain('--region=asia-northeast3 \\');
    expect(target.command).toContain(`--range=${CIDR_PLACEHOLDER} \\`);
    expect(target.command).toContain('--purpose=REGIONAL_MANAGED_PROXY');
  });
});
