import { describe, expect, it } from 'vitest';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';

describe('awsRoleArnDisplay', () => {
  it('shows just the role name under the target account own prefix', () => {
    expect(awsRoleArnDisplay('arn:aws:iam::918273645500:role/InfraScanRole', '918273645500', false)).toBe(
      'InfraScanRole',
    );
    expect(awsRoleArnDisplay('arn:aws-cn:iam::918273645500:role/InfraScanRole', '918273645500', true)).toBe(
      'InfraScanRole',
    );
  });

  it('keeps the full ARN for a cross-account role', () => {
    const arn = 'arn:aws:iam::111122223333:role/InfraScanRole';
    expect(awsRoleArnDisplay(arn, '918273645500', false)).toBe(arn);
  });

  it('keeps the full ARN on a partition mismatch — that prefix is the evidence', () => {
    const cn = 'arn:aws-cn:iam::918273645500:role/InfraScanRole';
    expect(awsRoleArnDisplay(cn, '918273645500', false)).toBe(cn);
    const global = 'arn:aws:iam::918273645500:role/InfraScanRole';
    expect(awsRoleArnDisplay(global, '918273645500', true)).toBe(global);
  });
});
