// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  defaultRdsInstanceResourceId,
  isRdsCluster,
  memberRole,
  memberRoleLabel,
  parseRdsInstanceCandidates,
  rdsInstanceLabel,
  readRdsInstanceMetadata,
  sortRdsInstances,
  type RdsInstanceCandidate,
} from '@/lib/rds-instances';

const instance = (
  suffix: string,
  role?: string,
  region = 'ap-northeast-2',
): RdsInstanceCandidate => ({
  resource_id: `arn:aws:rds:${region}:123456789012:db:demo-${suffix}`,
  resource_name: `demo-${suffix}`,
  host: `demo-${suffix}.abcdefghij.${region}.rds.amazonaws.com`,
  port: 3306,
  availability_zone: `${region}a`,
  ...(role ? { cluster_member_role: role } : {}),
});

describe('isRdsCluster', () => {
  it('accepts every cluster spelling, case-insensitively', () => {
    expect(isRdsCluster('AWS_DB_CLUSTER')).toBe(true);
    expect(isRdsCluster('AWS_RDS_CLUSTER')).toBe(true);
    // The alias `normalizeResourceType` canonicalises to, and what the demo seed carries.
    expect(isRdsCluster('RDS_CLUSTER')).toBe(true);
    expect(isRdsCluster('aws_db_cluster')).toBe(true);
  });

  it('rejects the single-instance and non-RDS types', () => {
    expect(isRdsCluster('AWS_DB_INSTANCE')).toBe(false);
    expect(isRdsCluster('RDS')).toBe(false);
    expect(isRdsCluster('AWS_REDSHIFT_CLUSTER')).toBe(false);
  });
});

describe('memberRole', () => {
  it('reads Reader/Writer regardless of casing (the contract guarantees none)', () => {
    expect(memberRole('Reader')).toBe('reader');
    expect(memberRole('READER')).toBe('reader');
    expect(memberRole('writer')).toBe('writer');
    expect(memberRole(' Writer ')).toBe('writer');
  });

  it('returns null for a missing or unrecognised member', () => {
    expect(memberRole(undefined)).toBeNull();
    expect(memberRole('')).toBeNull();
    expect(memberRole('PRIMARY')).toBeNull();
  });
});

// The contract's canonical values are uppercase; a chip that shouts WRITER reads as an alarm.
describe('memberRoleLabel', () => {
  it('prettifies the canonical uppercase values', () => {
    expect(memberRoleLabel('WRITER')).toBe('Writer');
    expect(memberRoleLabel('READER')).toBe('Reader');
  });

  it('accepts any casing the contract might send', () => {
    expect(memberRoleLabel('writer')).toBe('Writer');
    expect(memberRoleLabel(' Reader ')).toBe('Reader');
  });

  // An unrecognised role is shown as sent — inventing a label would hide what the server said.
  it('prints an unrecognised role verbatim, and an absent one as a dash', () => {
    expect(memberRoleLabel('PRIMARY')).toBe('PRIMARY');
    expect(memberRoleLabel(undefined)).toBe('—');
    expect(memberRoleLabel('')).toBe('—');
  });
});

describe('parseRdsInstanceCandidates', () => {
  it('drops entries with no resource_id — an instance nobody can select is not one', () => {
    const parsed = parseRdsInstanceCandidates([
      { resource_id: 'arn:a', resource_name: 'a', cluster_member_role: 'READER' },
      { resource_name: 'no-id' },
      { resource_id: '' },
      null,
      'nonsense',
    ]);
    expect(parsed).toEqual([
      { resource_id: 'arn:a', resource_name: 'a', cluster_member_role: 'READER' },
    ]);
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(parseRdsInstanceCandidates(undefined)).toEqual([]);
    expect(parseRdsInstanceCandidates(null)).toEqual([]);
    expect(parseRdsInstanceCandidates({ resource_id: 'arn:a' })).toEqual([]);
  });

  // host/port are never displayed, but the parsed array is what the approval payload echoes,
  // so dropping them would make the echo differ from what the server sent.
  it('preserves all six fields, host and port included', () => {
    const wire = {
      resource_id: 'arn:a',
      resource_name: 'a',
      host: 'a.cluster-abc.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      availability_zone: 'ap-northeast-2b',
      cluster_member_role: 'WRITER',
    };
    expect(parseRdsInstanceCandidates([wire])).toEqual([wire]);
  });

  it('drops optional fields of the wrong type rather than passing them through', () => {
    const [parsed] = parseRdsInstanceCandidates([
      {
        resource_id: 'arn:a',
        resource_name: 42,
        host: null,
        port: '3306',
        availability_zone: null,
        cluster_member_role: 'WRITER',
      },
    ]);
    expect(parsed).toEqual({ resource_id: 'arn:a', cluster_member_role: 'WRITER' });
  });
});

describe('sortRdsInstances', () => {
  it('puts Readers first, then orders by ARN', () => {
    const wireOrder = [instance('1', 'Writer'), instance('3', 'Reader'), instance('2', 'Reader')];
    expect(sortRdsInstances(wireOrder).map(rdsInstanceLabel)).toEqual([
      'demo-2',
      'demo-3',
      'demo-1',
    ]);
  });

  it('sorts an instance with no member last — it is not known to be safe', () => {
    const wireOrder = [instance('a'), instance('b', 'Writer'), instance('c', 'Reader')];
    expect(sortRdsInstances(wireOrder).map(rdsInstanceLabel)).toEqual([
      'demo-c',
      'demo-b',
      'demo-a',
    ]);
  });

  // The wire array is echoed verbatim in the approval payload; sorting is display only.
  it('does not mutate its input', () => {
    const wireOrder = [instance('1', 'Writer'), instance('2', 'Reader')];
    const snapshot = [...wireOrder];
    sortRdsInstances(wireOrder);
    expect(wireOrder).toEqual(snapshot);
  });
});

describe('defaultRdsInstanceResourceId', () => {
  const instances = [instance('1', 'Writer'), instance('3', 'Reader'), instance('2', 'Reader')];

  it("honours the server's choice when the cluster actually has that instance", () => {
    const writerResourceId = instances[0].resource_id;
    expect(defaultRdsInstanceResourceId(instances, writerResourceId)).toBe(writerResourceId);
  });

  it('falls back to the sorted-top Reader when the server named none', () => {
    expect(defaultRdsInstanceResourceId(instances)).toBe(instances[2].resource_id);
  });

  // No radio could render an ARN that is not in the list, leaving the group unselected.
  it('ignores a server ARN the cluster does not have', () => {
    expect(defaultRdsInstanceResourceId(instances, 'arn:aws:rds:elsewhere')).toBe(
      instances[2].resource_id,
    );
  });

  it('falls back to the top Writer when the cluster has no Reader', () => {
    const writersOnly = [instance('2', 'Writer'), instance('1', 'Writer')];
    expect(defaultRdsInstanceResourceId(writersOnly)).toBe(writersOnly[1].resource_id);
  });

  it('returns undefined for a cluster with no instances', () => {
    expect(defaultRdsInstanceResourceId([])).toBeUndefined();
  });
});

// The one adapter step 2 (latest), step 3 (approved-integration) and the history detail modal
// all spread. It has to yield NOTHING for a non-cluster, or every row would grow the keys.
describe('readRdsInstanceMetadata', () => {
  const instances = [instance('1', 'Writer'), instance('2', 'Reader')];
  const CLUSTER = 'AWS_DB_CLUSTER';

  it('surfaces the list and the chosen ARN from wire metadata', () => {
    expect(
      readRdsInstanceMetadata(
        {
          availability_zone: 'ap-northeast-2',
          rds_instance_candidates: instances,
          selected_rds_instance_resource_id: instances[1].resource_id,
        },
        CLUSTER,
      ),
    ).toEqual({ rdsInstanceCandidates: instances, selectedRdsInstanceResourceId: instances[1].resource_id });
  });

  // Writer-first in, Writer-first out: sorting belongs to the view, not the adapter.
  it('keeps the list in wire order', () => {
    expect(
      readRdsInstanceMetadata({ rds_instance_candidates: instances }, CLUSTER).rdsInstanceCandidates,
    ).toEqual(instances);
  });

  it('returns the list alone when nothing was chosen (an excluded cluster)', () => {
    expect(readRdsInstanceMetadata({ rds_instance_candidates: instances }, CLUSTER)).toEqual({
      rdsInstanceCandidates: instances,
    });
  });

  // The TYPE decides, not the list. A sibling type that also ships members must not inherit
  // the cluster grammar (tag + expandable instance rows) by accident.
  it('ignores a list on a type that is not a cluster', () => {
    expect(
      readRdsInstanceMetadata(
        { rds_instance_candidates: instances, selected_rds_instance_resource_id: instances[1].resource_id },
        'AWS_RDS_GLOBAL_CLUSTER',
      ),
    ).toEqual({});
    expect(readRdsInstanceMetadata({ rds_instance_candidates: instances }, 'AWS_DB_INSTANCE')).toEqual({});
    expect(readRdsInstanceMetadata({ rds_instance_candidates: instances }, null)).toEqual({});
    expect(readRdsInstanceMetadata({ rds_instance_candidates: instances }, undefined)).toEqual({});
  });

  it('returns nothing for absent or malformed metadata on a cluster', () => {
    expect(readRdsInstanceMetadata({ region: 'ap-northeast-2' }, CLUSTER)).toEqual({});
    expect(readRdsInstanceMetadata(undefined, CLUSTER)).toEqual({});
    expect(readRdsInstanceMetadata(null, CLUSTER)).toEqual({});
    expect(readRdsInstanceMetadata({ rds_instance_candidates: 'nonsense' }, CLUSTER)).toEqual({});
    // An empty list is not a cluster worth listing.
    expect(readRdsInstanceMetadata({ rds_instance_candidates: [] }, CLUSTER)).toEqual({});
  });

  it('drops a non-string chosen ARN rather than passing it through', () => {
    expect(
      readRdsInstanceMetadata(
        { rds_instance_candidates: instances, selected_rds_instance_resource_id: 42 },
        CLUSTER,
      ),
    ).toEqual({ rdsInstanceCandidates: instances });
  });
});

describe('rdsInstanceLabel', () => {
  it('prefers the identifier, then the ARN tail', () => {
    expect(rdsInstanceLabel(instance('1', 'Reader'))).toBe('demo-1');
    expect(rdsInstanceLabel({ resource_id: 'arn:aws:rds:r:acct:db:tail-only' })).toBe(
      'tail-only',
    );
  });
});
