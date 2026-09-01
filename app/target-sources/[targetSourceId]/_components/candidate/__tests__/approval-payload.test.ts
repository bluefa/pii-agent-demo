// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ApprovalSelectionInput } from '@/lib/approval-selection';
import {
  listMissingExclusionReasons,
  toApprovalRequestInput,
  toModalResources,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import type { CandidateDraftState, CandidateResource } from '@/lib/types/resources';

const drafts: CandidateDraftState = { endpointDrafts: {}, rdsInstanceDrafts: {} };

// 평범한(credential/default behavior) 클라우드 후보. 스캔 행은 접속 정보를 실을 자리가
// 없으므로 이 행이 보내는 것은 선택 여부뿐이어야 한다.
const cloudCandidate: CandidateResource = {
  id: 'res-1',
  resourceId: 'arn:aws:rds:ap-northeast-1:acct:db:mydb',
  resourceName: 'mydb',
  type: 'RDS',
  databaseType: 'MYSQL',
  integrationCategory: 'TARGET',
  behaviorKey: 'default',
  selected: true,
  exclusionReason: null,
  recommendFailReason: null,
  metadata: { provider: 'AWS', resourceType: 'RDS', region: 'ap-northeast-1' },
};

/**
 * 이 어댑터는 이제 선택만 만든다. 리소스가 무엇인지(이름·타입·카테고리·provider·region·
 * database_type·RDS 멤버 목록)와 스캔 판정(recommend_fail_reason)은 라우트가 스캔 결과에서
 * 읽어 붙인다 — 그쪽 규칙은 `app/api/v1/__tests__/approval-input.test.ts` 가 지킨다.
 */
describe('approval-payload', () => {
  it('선택한 행은 id 와 선택 여부만 보낸다', () => {
    const input = toApprovalRequestInput([cloudCandidate], new Set(['res-1']), drafts, {});
    const [item] = input.resources;

    expect(item).toEqual({ resource_id: 'res-1', selected: true });
    expect(() => ApprovalSelectionInput.parse(input)).not.toThrow();
  });

  it('사실 서술은 더 이상 클라이언트가 주장하지 않는다', () => {
    const input = toApprovalRequestInput([cloudCandidate], new Set(['res-1']), drafts, {});
    const [item] = input.resources;

    for (const key of ['resource_name', 'resource_type', 'integration_category', 'metadata']) {
      expect(item).not.toHaveProperty(key);
    }
  });

  it('확정 모달에는 databaseType 이 그대로 보인다 (LIN-49)', () => {
    const [row] = toModalResources([cloudCandidate], new Set(['res-1']), drafts);
    expect(row.databaseType).toBe('MYSQL');
  });

  it('사용자가 적은 제외 사유는 보내고, 스캔 판정은 보내지 않는다', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      recommendFailReason: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
    };
    const input = toApprovalRequestInput([ineligible], new Set<string>(), drafts, {
      'res-1': '운영팀 요청으로 제외',
    });
    const [item] = input.resources;

    expect(item.selected).toBe(false);
    expect(item.exclusion_reason).toBe('운영팀 요청으로 제외');
    // 스캔 판정은 라우트가 권위 있는 행에서 읽는다 — 클라이언트가 되풀이하지 않는다.
    expect(item).not.toHaveProperty('recommend_fail_reason');
  });

  it('사유가 비어 있으면 키 자체를 보내지 않는다 (라우트가 스캔 판정으로 채운다)', () => {
    const input = toApprovalRequestInput([cloudCandidate], new Set<string>(), drafts, {
      'res-1': '   ',
    });
    expect(input.resources[0]).not.toHaveProperty('exclusion_reason');
  });

  // 제외 사유는 필수다(docs/cloud-provider-states.md): 사유 없는 미선택 TARGET 은 승인
  // 요청을 막고, TARGET 이 아닌 행은 사유가 필요 없다.
  it('listMissingExclusionReasons 는 사유 없는 미선택 TARGET 을 집는다', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      id: 'res-2',
      integrationCategory: 'INSTALL_INELIGIBLE',
    };

    expect(
      listMissingExclusionReasons([cloudCandidate, ineligible], new Set<string>(), {}),
    ).toEqual([cloudCandidate]);
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '미사용' }),
    ).toEqual([]);
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set(['res-1']), {}),
    ).toEqual([]);
  });

  // 이 목록이 승인 CTA 를 잠그므로, 흘러든 공백은 사유가 아니라 누락으로 세어야 한다.
  it('빈 문자열과 공백만 있는 사유는 누락으로 센다', () => {
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '' }),
    ).toEqual([cloudCandidate]);
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '   ' }),
    ).toEqual([cloudCandidate]);
  });
});

// RDS 클러스터는 멤버 인스턴스 하나로 접속한다. 어느 멤버를 쓸지는 사용자의 결정이라
// 클라이언트가 보내고, 그 선택이 실제 멤버인지와 그 멤버의 역할은 라우트가 확인한다.
describe('approval-payload — RDS 클러스터 멤버 선택', () => {
  const writer = {
    resource_id: 'arn:aws:rds:ap-northeast-2:acct:db:demo-1',
    resource_name: 'demo-1',
    availability_zone: 'ap-northeast-2',
    cluster_member_role: 'WRITER',
  };
  const readerHigh = { ...writer, resource_id: 'arn:aws:rds:ap-northeast-2:acct:db:demo-3', resource_name: 'demo-3', cluster_member_role: 'READER' };
  const readerLow = { ...writer, resource_id: 'arn:aws:rds:ap-northeast-2:acct:db:demo-2', resource_name: 'demo-2', cluster_member_role: 'READER' };
  // 와이어가 주는 대로 정렬되지 않은 상태: Writer 가 먼저, reader 들은 ARN 순이 아니다.
  const wireOrder = [writer, readerHigh, readerLow];

  const cluster: CandidateResource = {
    id: 'cluster-1',
    resourceId: 'arn:aws:rds:ap-northeast-2:acct:cluster:demo',
    resourceName: 'demo-cluster',
    type: 'AWS_DB_CLUSTER',
    databaseType: 'MYSQL',
    integrationCategory: 'TARGET',
    behaviorKey: 'rdsInstance',
    selected: true,
    exclusionReason: null,
    recommendFailReason: null,
    rdsInstanceCandidates: wireOrder,
    metadata: { provider: 'AWS', resourceType: 'AWS_DB_CLUSTER', region: 'ap-northeast-2' },
  };

  it('기본값은 정렬 최상단 Reader 다', () => {
    const [item] = toApprovalRequestInput([cluster], new Set(['cluster-1']), drafts, {}).resources;
    expect(item.selected_rds_instance_resource_id).toBe(readerLow.resource_id);
  });

  it('서버가 고른 값이 정렬 기본값을 이긴다', () => {
    const seeded: CandidateResource = { ...cluster, selectedRdsInstanceResourceId: writer.resource_id };
    const [item] = toApprovalRequestInput([seeded], new Set(['cluster-1']), drafts, {}).resources;
    expect(item.selected_rds_instance_resource_id).toBe(writer.resource_id);
  });

  it('사용자 초안이 둘 다 이긴다', () => {
    const withDraft = { ...drafts, rdsInstanceDrafts: { 'cluster-1': readerHigh.resource_id } };
    const seeded: CandidateResource = { ...cluster, selectedRdsInstanceResourceId: writer.resource_id };
    const [item] = toApprovalRequestInput([seeded], new Set(['cluster-1']), withDraft, {}).resources;
    expect(item.selected_rds_instance_resource_id).toBe(readerHigh.resource_id);
  });

  it('제외된 클러스터에는 고른 멤버를 보내지 않는다', () => {
    const [item] = toApprovalRequestInput([cluster], new Set<string>(), drafts, {
      'cluster-1': '미사용 클러스터',
    }).resources;
    expect(item.selected).toBe(false);
    expect(item).not.toHaveProperty('selected_rds_instance_resource_id');
  });

  it('클러스터가 아닌 리소스에는 멤버 선택이 붙지 않는다', () => {
    const [item] = toApprovalRequestInput([cloudCandidate], new Set(['res-1']), drafts, {}).resources;
    expect(item).not.toHaveProperty('selected_rds_instance_resource_id');
  });
});
