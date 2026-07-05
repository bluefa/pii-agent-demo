// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';
import {
  toApprovalRequestInput,
  toModalResources,
} from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/approval-payload';
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
});
