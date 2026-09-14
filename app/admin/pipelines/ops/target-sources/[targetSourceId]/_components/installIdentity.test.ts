import { describe, it, expect } from 'vitest';
import { installResourceIdentity } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installIdentity';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

const row = (over: Partial<ConfirmedIntegrationResourceInfo>): ConfirmedIntegrationResourceInfo =>
  ({
    resource_id: 'idc-res-002',
    resource_type: 'IDC_RESOURCE',
    database_type: 'ORACLE',
    database_region: null,
    resource_name: null,
    port: 1521,
    host: null,
    oracle_service_id: null,
    network_interface_id: null,
    ip_configuration: null,
    ...over,
  }) as ConfirmedIntegrationResourceInfo;

describe('installResourceIdentity — what the open-resource row prints for an id', () => {
  it('IDC IP mode: every ip with the port, the DB type alongside', () => {
    expect(
      installResourceIdentity(row({ idc_host_format: 'IP', idc_ips: ['10.20.31.10', '10.20.31.11'] })),
    ).toEqual({ label: '10.20.31.10:1521 · 10.20.31.11:1521', databaseType: 'ORACLE' });
  });

  it('IDC HOST mode: the host with the port', () => {
    expect(installResourceIdentity(row({ idc_host_format: 'HOST', idc_host: 'db.corp.local' })).label).toBe(
      'db.corp.local:1521',
    );
  });

  it('no idc_* at all: falls back to `host`, and without a port prints the host alone', () => {
    expect(installResourceIdentity(row({ host: 'rds.internal', port: null })).label).toBe('rds.internal');
  });

  it('a CSP name wins over the address', () => {
    expect(
      installResourceIdentity(row({ resource_name: 'prod-orders', idc_host_format: 'IP', idc_ips: ['10.0.0.1'] })).label,
    ).toBe('prod-orders');
  });

  it('nothing to print but the id: the id', () => {
    expect(installResourceIdentity(row({})).label).toBe('idc-res-002');
  });
});
