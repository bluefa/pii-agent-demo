// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';
import { toIdcApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep1TargetInput';
import type { IdcStep1Row } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcTargetListTable';

const row = (o: Partial<IdcStep1Row> = {}): IdcStep1Row => ({
  resourceId: 'idc-1',
  persisted: false,
  kind: 'SINGLE',
  hosts: ['10.0.0.5'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: [],
  firewallOpen: false,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
  exclusionCustom: false,
  ...o,
});

describe('toIdcApprovalRequestInput', () => {
  it('IP-mode selected row carries the manually-entered connection info under metadata (LIN-52)', () => {
    const input = toIdcApprovalRequestInput([row({ oracleSid: 'ORCL', credentialId: 'cred-1' })]);
    const item = (input.resources ?? [])[0];

    expect(item.selected).toBe(true);
    expect(item.metadata).toMatchObject({
      provider: 'IDC',
      idc_host_format: 'IP',
      idc_ips: ['10.0.0.5'],
      port: 3306,
      // Requests send database_type lowercase (IDC wire enum is 'MYSQL').
      database_type: 'mysql',
      oracle_service_id: 'ORCL',
      credential_id: 'cred-1',
    });
    // Domain-only + Step-2-assigned fields are not sent from Step 1.
    expect(item.metadata).not.toHaveProperty('idc_host');
    expect(item.metadata).not.toHaveProperty('idc_source_ips');
    // Still a valid contract item.
    expect(() => schemas.TargetSourceResourceItemDto.parse(item)).not.toThrow();
  });

  it('round-trips a DB type outside the known enum via the raw label (databaseTypeWire undefined)', () => {
    // A loaded previous-request row with a server-side DB type the frontend enum does
    // not know: toIdcResourceView leaves databaseTypeWire undefined and keeps the raw
    // wire value in databaseTypeLabel. It must still be resubmitted.
    const input = toIdcApprovalRequestInput([
      row({ databaseTypeWire: undefined, databaseTypeLabel: 'COCKROACHDB' }),
    ]);
    const meta = (input.resources ?? [])[0].metadata;
    // Preserved AND lowercased on the request.
    expect(meta?.database_type).toBe('cockroachdb');
  });

  it('DOMAIN-mode row uses idc_host (not idc_ips)', () => {
    const input = toIdcApprovalRequestInput([row({ kind: 'DOMAIN', hosts: ['db.example.com'] })]);
    const meta = (input.resources ?? [])[0].metadata;

    expect(meta).toMatchObject({ idc_host_format: 'HOST', idc_host: 'db.example.com' });
    expect(meta).not.toHaveProperty('idc_ips');
  });

  it('excluded row carries exclusion reason AND its connection metadata (not just resource_id)', () => {
    const input = toIdcApprovalRequestInput([row({ excluded: true, exclusionReason: '미사용 인스턴스' })]);
    const item = (input.resources ?? [])[0];

    expect(item.selected).toBe(false);
    expect(item.exclusion_reason).toBe('미사용 인스턴스');
    // Excluded rows stay identifiable: the entered connection info is kept.
    expect(item.metadata).toMatchObject({
      provider: 'IDC',
      idc_host_format: 'IP',
      idc_ips: ['10.0.0.5'],
      port: 3306,
      database_type: 'mysql',
    });
    expect(() => schemas.TargetSourceResourceItemDto.parse(item)).not.toThrow();
  });
});
