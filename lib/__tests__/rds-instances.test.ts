// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  defaultRdsInstanceArn,
  isRdsCluster,
  memberRole,
  parseRdsInstanceList,
  rdsInstanceLabel,
  sortRdsInstances,
  type RdsInstanceWire,
} from '@/lib/rds-instances';

const instance = (
  suffix: string,
  member?: string,
  region = 'ap-northeast-2',
): RdsInstanceWire => ({
  rds_instance_arn: `arn:aws:rds:${region}:123456789012:db:demo-${suffix}`,
  rds_instance_identifier: `demo-${suffix}`,
  region,
  ...(member ? { member } : {}),
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

describe('parseRdsInstanceList', () => {
  it('drops entries with no usable ARN — an instance nobody can select is not one', () => {
    const parsed = parseRdsInstanceList([
      { rds_instance_arn: 'arn:a', rds_instance_identifier: 'a', member: 'Reader' },
      { rds_instance_identifier: 'no-arn' },
      { rds_instance_arn: '' },
      null,
      'nonsense',
    ]);
    expect(parsed).toEqual([
      { rds_instance_arn: 'arn:a', rds_instance_identifier: 'a', member: 'Reader' },
    ]);
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(parseRdsInstanceList(undefined)).toEqual([]);
    expect(parseRdsInstanceList(null)).toEqual([]);
    expect(parseRdsInstanceList({ rds_instance_arn: 'arn:a' })).toEqual([]);
  });

  it('keeps only string-typed optional fields', () => {
    const [parsed] = parseRdsInstanceList([
      { rds_instance_arn: 'arn:a', rds_instance_identifier: 42, region: null, member: 'Writer' },
    ]);
    expect(parsed).toEqual({ rds_instance_arn: 'arn:a', member: 'Writer' });
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

describe('defaultRdsInstanceArn', () => {
  const instances = [instance('1', 'Writer'), instance('3', 'Reader'), instance('2', 'Reader')];

  it("honours the server's choice when the cluster actually has that instance", () => {
    const writerArn = instances[0].rds_instance_arn;
    expect(defaultRdsInstanceArn(instances, writerArn)).toBe(writerArn);
  });

  it('falls back to the sorted-top Reader when the server named none', () => {
    expect(defaultRdsInstanceArn(instances)).toBe(instances[2].rds_instance_arn);
  });

  // No radio could render an ARN that is not in the list, leaving the group unselected.
  it('ignores a server ARN the cluster does not have', () => {
    expect(defaultRdsInstanceArn(instances, 'arn:aws:rds:elsewhere')).toBe(
      instances[2].rds_instance_arn,
    );
  });

  it('falls back to the top Writer when the cluster has no Reader', () => {
    const writersOnly = [instance('2', 'Writer'), instance('1', 'Writer')];
    expect(defaultRdsInstanceArn(writersOnly)).toBe(writersOnly[1].rds_instance_arn);
  });

  it('returns undefined for a cluster with no instances', () => {
    expect(defaultRdsInstanceArn([])).toBeUndefined();
  });
});

describe('rdsInstanceLabel', () => {
  it('prefers the identifier, then the ARN tail', () => {
    expect(rdsInstanceLabel(instance('1', 'Reader'))).toBe('demo-1');
    expect(rdsInstanceLabel({ rds_instance_arn: 'arn:aws:rds:r:acct:db:tail-only' })).toBe(
      'tail-only',
    );
  });
});
