import { describe, it, expect } from 'vitest';
import { isEc2Instance } from '@/lib/types';

/**
 * The EC2 kind tag keys on this predicate on all five surfaces (step 1, steps 2·3, steps 4·6·7,
 * step 5 연결 테스트, admin 요청 상세). It replaced a `behaviorKey === 'manualEc2'` check that
 * lived only in step 1's component state — that tag vanished on reload and never reached the
 * later steps or admin at all.
 */
describe('isEc2Instance', () => {
  it('accepts the contract spelling and the alias it normalises to', () => {
    expect(isEc2Instance('AWS_EC2_INSTANCE')).toBe(true);
    expect(isEc2Instance('EC2')).toBe(true);
  });

  // The wire is not guaranteed to shout, and surfaces read the type from different fields.
  it('is case- and whitespace-insensitive', () => {
    expect(isEc2Instance('aws_ec2_instance')).toBe(true);
    expect(isEc2Instance('  Ec2  ')).toBe(true);
  });

  // Rows reach these call sites with the field absent — a missing type is not an EC2 instance.
  it('rejects absent or non-string types instead of throwing', () => {
    expect(isEc2Instance(undefined)).toBe(false);
    expect(isEc2Instance(null)).toBe(false);
    expect(isEc2Instance('')).toBe(false);
    expect(isEc2Instance(42)).toBe(false);
  });

  // Neighbours in the same enum. AZURE_VIRTUAL_MACHINE is the closest concept — a VM the user
  // installs a database on — and it must not borrow the AWS tag.
  it('rejects every other resource type', () => {
    expect(isEc2Instance('AWS_DB_INSTANCE')).toBe(false);
    expect(isEc2Instance('AWS_DB_CLUSTER')).toBe(false);
    expect(isEc2Instance('AZURE_VIRTUAL_MACHINE')).toBe(false);
    expect(isEc2Instance('AWS_EC2_INSTANCE_PROFILE')).toBe(false);
  });
});
