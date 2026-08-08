// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';
import { toApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import { toManualEc2Candidate } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';
import type { CandidateDraftState } from '@/lib/types/resources';

const drafts: CandidateDraftState = { endpointDrafts: {}, rdsInstanceDrafts: {} };

const instance = {
  instanceId: 'i-0a1b2c3d4e5f67890',
  privateIpAddress: '10.10.1.24',
  privateDnsName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
  scanVersion: 12,
};

/**
 * A manually added EC2 instance reaches the backend through the SAME approval request as every
 * scanned candidate. The connection info the user typed is the only channel that carries this
 * host at all, so these assertions pin the whole mapping: the wire resource type, and the four
 * metadata fields the row was created to supply.
 */
describe('manual EC2 → approval request', () => {
  it('sends the instance id, AWS_EC2_INSTANCE and the typed connection info', () => {
    const candidate = toManualEc2Candidate(instance, { databaseType: 'MYSQL', port: 3306 });
    const input = toApprovalRequestInput(
      [candidate],
      new Set([instance.instanceId]),
      drafts,
      {},
    );
    const item = (input.resources ?? [])[0];

    expect(item.resource_id).toBe(instance.instanceId);
    expect(item.resource_type).toBe('AWS_EC2_INSTANCE');
    expect(item.selected).toBe(true);
    // host is the Private IP the scan reported — the address field is read-only for this reason.
    expect(item.metadata?.host).toBe('10.10.1.24');
    expect(item.metadata?.database_type).toBe('mysql');
    expect(item.metadata?.port).toBe(3306);
    expect(item.metadata?.oracle_service_id).toBeUndefined();
    expect(() => schemas.TargetSourceResourceItemDto.parse(item)).not.toThrow();
  });

  it('carries the SID for the engines that require one, and only those', () => {
    const oracle = toManualEc2Candidate(instance, {
      databaseType: 'TIBERO',
      port: 8629,
      oracleServiceId: 'ORCL',
    });
    const input = toApprovalRequestInput([oracle], new Set([instance.instanceId]), drafts, {});

    expect((input.resources ?? [])[0].metadata?.oracle_service_id).toBe('ORCL');
  });

  it('needs no exclusion reason when unchecked — the row is the user’s own addition', () => {
    const candidate = toManualEc2Candidate(instance, { databaseType: 'MYSQL', port: 3306 });
    const input = toApprovalRequestInput([candidate], new Set<string>(), drafts, {});
    const item = (input.resources ?? [])[0];

    expect(item.selected).toBe(false);
    expect(item.integration_category).toBe('NO_INSTALL_NEEDED');
    expect(item.exclusion_reason).toBeUndefined();
  });
});
