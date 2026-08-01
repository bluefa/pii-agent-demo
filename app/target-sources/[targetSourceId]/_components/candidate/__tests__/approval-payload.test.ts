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
