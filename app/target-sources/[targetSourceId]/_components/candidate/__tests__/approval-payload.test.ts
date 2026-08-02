// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';
import {
  listMissingExclusionReasons,
  toApprovalRequestInput,
  toModalResources,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import type { CandidateDraftState, CandidateResource } from '@/lib/types/resources';

const drafts: CandidateDraftState = { endpointDrafts: {} };

// A plain (credential/default behavior) cloud candidate: no endpoint fields, so the
// submitted metadata must come from the candidate itself (the regression path).
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

describe('approval-payload', () => {
  it('carries provider/region/database_type under metadata and the real resource_name (LIN-41/44/50)', () => {
    const input = toApprovalRequestInput([cloudCandidate], new Set(['res-1']), drafts, {});
    const item = (input.resources ?? [])[0];

    expect(item.metadata?.provider).toBe('AWS');
    expect(item.metadata?.region).toBe('ap-northeast-1');
    // Requests send database_type lowercase-canonical (candidate.databaseType is 'MYSQL').
    expect(item.metadata?.database_type).toBe('mysql');
    expect(item.resource_name).toBe('mydb');
    // Still a valid contract item (no off-contract fields).
    expect(() => schemas.TargetSourceResourceItemDto.parse(item)).not.toThrow();
  });

  it('exposes databaseType to the confirm modal (LIN-49)', () => {
    const [row] = toModalResources([cloudCandidate], new Set(['res-1']), drafts);
    expect(row.databaseType).toBe('MYSQL');
  });

  it('non-selected item still carries name/category and intrinsic metadata (not just resource_id)', () => {
    const input = toApprovalRequestInput(
      [cloudCandidate],
      new Set<string>(),
      drafts,
      { 'res-1': '미사용 인스턴스' },
    );
    const item = (input.resources ?? [])[0];

    expect(item.selected).toBe(false);
    expect(item.exclusion_reason).toBe('미사용 인스턴스');
    expect(item.resource_name).toBe('mydb');
    expect(item.integration_category).toBe('TARGET');
    expect(item.metadata).toMatchObject({
      provider: 'AWS',
      region: 'ap-northeast-1',
      database_type: 'mysql',
    });
    expect(() => schemas.TargetSourceResourceItemDto.parse(item)).not.toThrow();
  });

  // Exclusion reason is required (docs/cloud-provider-states.md): an unselected
  // TARGET without a reason blocks the approval request; non-TARGET rows never
  // require one.
  it('listMissingExclusionReasons flags unselected TARGETs without a reason', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      id: 'res-2',
      integrationCategory: 'INSTALL_INELIGIBLE',
    };

    // No reason recorded → flagged.
    expect(
      listMissingExclusionReasons([cloudCandidate, ineligible], new Set<string>(), {}),
    ).toEqual([cloudCandidate]);

    // Reason present → clear. Selected → clear.
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '미사용' }),
    ).toEqual([]);
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set(['res-1']), {}),
    ).toEqual([]);
  });

  // An install-ineligible row cannot carry a user reason (its checkbox is disabled), so the
  // scan's verdict is submitted in its place — every downstream reader keys off
  // exclusion_reason and would otherwise show a blank cell. The verdict also rides along in
  // its own field so the fact stays machine-readable.
  it('submits the scan verdict as both recommend_fail_reason and exclusion_reason', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      id: 'res-inel',
      integrationCategory: 'INSTALL_INELIGIBLE',
      selected: false,
      recommendFailReason: 'AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED',
    };
    const [item] = toApprovalRequestInput([ineligible], new Set<string>(), drafts, {}).resources!;
    expect(item.selected).toBe(false);
    expect(item.integration_category).toBe('INSTALL_INELIGIBLE');
    expect(item.recommend_fail_reason).toBe('AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED');
    expect(item.exclusion_reason).toBe('AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED');
    expect(() => schemas.ApprovalRequestInputDto.parse({ resources: [item] })).not.toThrow();
  });

  // The enum covers GCP (2) + Azure (1); an ineligible AWS or IDC resource has no reason at
  // all, and inventing one would be worse than the blank.
  it('omits both reason fields when the scan gave no verdict', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      id: 'res-inel-2',
      integrationCategory: 'INSTALL_INELIGIBLE',
      selected: false,
    };
    const [item] = toApprovalRequestInput([ineligible], new Set<string>(), drafts, {}).resources!;
    expect(item.recommend_fail_reason).toBeUndefined();
    expect(item.exclusion_reason).toBeUndefined();
  });

  // A user reason must win: the substitution exists only to fill an empty cell.
  it('keeps a user reason ahead of the scan verdict', () => {
    const ineligible: CandidateResource = {
      ...cloudCandidate,
      id: 'res-inel-3',
      integrationCategory: 'INSTALL_INELIGIBLE',
      selected: false,
      recommendFailReason: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
    };
    const [item] = toApprovalRequestInput([ineligible], new Set<string>(), drafts, {
      'res-inel-3': '운영팀 요청으로 제외',
    }).resources!;
    expect(item.exclusion_reason).toBe('운영팀 요청으로 제외');
    expect(item.recommend_fail_reason).toBe('GCP_CLOUD_SQL_HAS_PUBLIC_IP');
  });

  // The list now gates (disables) the approval CTA, so a blank that slipped in —
  // empty string or whitespace-only — must count as missing, not as a reason.
  it('treats empty and whitespace-only reasons as missing', () => {
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '' }),
    ).toEqual([cloudCandidate]);
    expect(
      listMissingExclusionReasons([cloudCandidate], new Set<string>(), { 'res-1': '   ' }),
    ).toEqual([cloudCandidate]);
  });
});
