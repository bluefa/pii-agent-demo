import { describe, expect, it } from 'vitest';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';

const ACCOUNT = '804656952396';
const OTHER = '111122223333';

describe('awsRoleArnDisplay', () => {
  it('drops the prefix this target would itself compose', () => {
    expect(awsRoleArnDisplay(`arn:aws:iam::${ACCOUNT}:role/BDCPIIInfraScanRole`, ACCOUNT, false))
      .toBe('BDCPIIInfraScanRole');
  });

  it('drops the aws-cn prefix on a China target', () => {
    expect(awsRoleArnDisplay(`arn:aws-cn:iam::${ACCOUNT}:role/ScanRole`, ACCOUNT, true))
      .toBe('ScanRole');
  });

  // The three cases below are the reason the function is not a bare `split(':role/')`.
  // Each one differs from this target exactly in the segment a naive cut removes.
  it('keeps a role that lives in another account', () => {
    const arn = `arn:aws:iam::${OTHER}:role/ScanRole`;
    expect(awsRoleArnDisplay(arn, ACCOUNT, false)).toBe(arn);
  });

  it('keeps an aws-cn ARN when the target is global', () => {
    const arn = `arn:aws-cn:iam::${ACCOUNT}:role/ScanRole`;
    expect(awsRoleArnDisplay(arn, ACCOUNT, false)).toBe(arn);
  });

  it('keeps an aws ARN when the target is China', () => {
    const arn = `arn:aws:iam::${ACCOUNT}:role/ScanRole`;
    expect(awsRoleArnDisplay(arn, ACCOUNT, true)).toBe(arn);
  });

  it('keeps everything when the target has no account to compare against', () => {
    const arn = `arn:aws:iam::${ACCOUNT}:role/ScanRole`;
    expect(awsRoleArnDisplay(arn, null, false)).toBe(arn);
    expect(awsRoleArnDisplay(arn, '', false)).toBe(arn);
  });
});
