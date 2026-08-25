import { describe, expect, it } from 'vitest';
import {
  terraformRoleFinding,
  TERRAFORM_ROLE_REASON_CODES,
} from '@/app/components/features/process-status/aws/terraform-role-finding';
import { ROLE_VERIFICATION_REASON_CODES } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleVerification';

describe('terraformRoleFinding — 계약 여섯 코드', () => {
  it.each(TERRAFORM_ROLE_REASON_CODES)('%s 는 문장을 갖는다', (code) => {
    const finding = terraformRoleFinding({ status: 'INVALID', fail_reason: code });
    expect(finding?.message).toBeTruthy();
    // 매핑된 코드는 코드 자체를 화면에 노출하지 않는다 — 문장이 그 일을 한다.
    expect(finding?.rawCode).toBeNull();
  });

  it('검증을 통과했으면 그릴 것이 없다', () => {
    expect(terraformRoleFinding({ status: 'VALID', role_arn: 'arn:aws:iam::1:role/X' })).toBeNull();
  });

  it('진행 중은 실패가 아니다 — 빈 상태로 둔다', () => {
    expect(terraformRoleFinding({ status: 'IN_PROGRESS' })).toBeNull();
  });

  it('맵에 없는 코드는 뭉개지 않고 그대로 노출한다', () => {
    const finding = terraformRoleFinding({
      status: 'INVALID',
      fail_reason: 'ROLE_SESSION_POLICY_DENIED',
    });
    expect(finding?.rawCode).toBe('ROLE_SESSION_POLICY_DENIED');
    expect(finding?.message).toBeTruthy();
  });

  it('코드가 없으면 fail_message 가 문장을 대신한다', () => {
    const finding = terraformRoleFinding({ status: 'FAIL', fail_message: '업스트림이 준 문장' });
    expect(finding?.message).toBe('업스트림이 준 문장');
  });
});

/**
 * 같은 계약을 두 화면이 각자의 청중에게 옮긴다 — 운영자용(roleVerification.ts)과
 * 요청자용(terraform-role-finding.ts). 문장은 달라야 하지만 다루는 코드 집합은 같아야
 * 한다. 계약에 코드가 붙었을 때 한쪽만 늘어나면 다른 화면은 그 원인을 말하지 못한다.
 */
describe('요청자용 맵과 운영자용 맵은 같은 코드 집합을 덮는다', () => {
  it('키 집합이 일치한다', () => {
    expect([...TERRAFORM_ROLE_REASON_CODES].sort()).toEqual(
      [...ROLE_VERIFICATION_REASON_CODES].sort(),
    );
  });
});
