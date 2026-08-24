// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ApprovalSelectionInput } from '@/lib/approval-selection';
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
 * 수기 추가 EC2 행이 승인 요청에 실리는 모양. 이제 클라이언트가 보내는 것은 선택과
 * 사용자가 친 접속 정보뿐이다 — resource_type·integration_category·주소는 라우트가
 * EC2 검색 결과에서 읽어 붙인다(`app/api/v1/__tests__/approval-input.test.ts`).
 */
describe('manual EC2 → approval selection', () => {
  it('사용자가 친 접속 정보를 endpoint 로 보낸다', () => {
    const candidate = toManualEc2Candidate(instance, { databaseType: 'MYSQL', port: 3306 });
    const input = toApprovalRequestInput([candidate], new Set([instance.instanceId]), drafts, {});
    const [item] = input.resources;

    expect(item.resource_id).toBe(instance.instanceId);
    expect(item.selected).toBe(true);
    expect(item.endpoint?.database_type).toBe('mysql');
    expect(item.endpoint?.port).toBe(3306);
    expect(item.endpoint?.oracle_service_id).toBeUndefined();
    expect(() => ApprovalSelectionInput.parse(input)).not.toThrow();
  });

  it('정체성과 판정은 더 이상 클라이언트가 주장하지 않는다', () => {
    const candidate = toManualEc2Candidate(instance, { databaseType: 'MYSQL', port: 3306 });
    const input = toApprovalRequestInput([candidate], new Set([instance.instanceId]), drafts, {});
    const [item] = input.resources;

    expect(item).not.toHaveProperty('resource_type');
    expect(item).not.toHaveProperty('integration_category');
    expect(item).not.toHaveProperty('metadata');
  });

  it('SID 가 필요한 엔진에서만 SID 를 싣는다', () => {
    const oracle = toManualEc2Candidate(instance, {
      databaseType: 'TIBERO',
      port: 8629,
      oracleServiceId: 'ORCL',
    });
    const input = toApprovalRequestInput([oracle], new Set([instance.instanceId]), drafts, {});

    expect(input.resources[0].endpoint?.oracle_service_id).toBe('ORCL');
  });

  it('체크를 풀어도 제외 사유가 필요 없다 — 사용자가 자기 추가를 되돌리는 것이다', () => {
    const candidate = toManualEc2Candidate(instance, { databaseType: 'MYSQL', port: 3306 });
    const input = toApprovalRequestInput([candidate], new Set<string>(), drafts, {});
    const [item] = input.resources;

    expect(item.selected).toBe(false);
    expect(item.exclusion_reason).toBeUndefined();
  });
});
