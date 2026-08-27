import { describe, expect, it } from 'vitest';
import { awsRoleArnDisplay } from '@/lib/constants/aws-role';

describe('awsRoleArnDisplay', () => {
  it('shows just the role name under the target account own prefix', () => {
    expect(awsRoleArnDisplay('arn:aws:iam::918273645500:role/InfraScanRole')).toBe('InfraScanRole');
    expect(awsRoleArnDisplay('arn:aws-cn:iam::918273645500:role/InfraScanRole')).toBe(
      'InfraScanRole',
    );
  });

  it('shows the role name for a cross-account role too (owner, 2026-08-27)', () => {
    expect(awsRoleArnDisplay('arn:aws:iam::111122223333:role/InfraScanRole')).toBe('InfraScanRole');
  });

  it('shows the role name on a partition mismatch too — the prefix is no longer the only evidence', () => {
    // 전문은 복사 값·title·「상세 정보」 세 자리에 남는다.
    expect(awsRoleArnDisplay('arn:aws-cn:iam::918273645500:role/InfraScanRole')).toBe(
      'InfraScanRole',
    );
    expect(awsRoleArnDisplay('arn:aws:iam::918273645500:role/InfraScanRole')).toBe('InfraScanRole');
  });

  it('returns the whole string when there is no role segment — the cell never renders empty', () => {
    expect(awsRoleArnDisplay('BDCPIIInfraScanRole')).toBe('BDCPIIInfraScanRole');
    const trailing = 'arn:aws:iam::918273645500:role/';
    expect(awsRoleArnDisplay(trailing)).toBe(trailing);
  });
});
