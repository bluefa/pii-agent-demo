/**
 * The fold table — which of the four screen states each contract pair
 * (status × fail_reason) lands on.
 *
 * One thing is measured here: **tone and action target**. Not the wording —
 * those two are what change the operator's next move, and SCAN_ROLE_* in
 * particular splits what was verified (execution) from what must be fixed
 * (scan), so a silent flip sends someone to edit the wrong role.
 */
import { describe, it, expect, vi } from 'vitest';

// This file measures the pure mapping — the fetch layer only has to let the module load.
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn() }));
vi.mock('@/app/lib/api/azure', () => ({ getAzureScanApp: vi.fn() }));
vi.mock('@/app/lib/api/gcp', () => ({ getGcpScanServiceAccount: vi.fn() }));

import { roleVerdict } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleVerification';

describe('roleVerdict — 계약 여섯 코드', () => {
  it('등록 전은 오류가 아니다 — INVALID 로 와도 중립 톤 + 등록 CTA', () => {
    const v = roleVerdict('scan', { status: 'INVALID', fail_reason: 'ROLE_NOT_CONFIGURED' });
    expect(v.tone).toBe('off');
    expect(v.action).toEqual({ kind: 'edit', role: 'scan', label: '등록하기' });
    // The sentence names the role that was verified.
    expect(v.message).toContain('Scan Role');
  });

  it('같은 코드라도 execution 을 검증했으면 그 Role 이름으로 말한다', () => {
    const v = roleVerdict('execution', { status: 'INVALID', fail_reason: 'ROLE_NOT_CONFIGURED' });
    expect(v.message).toContain('Terraform Execution Role');
    expect(v.action?.role).toBe('execution');
  });

  it.each([
    ['INVALID_ROLE_ARN', 'scan'],
    ['ROLE_NOT_FOUND', 'execution'],
  ] as const)('%s 는 등록된 값이 틀린 것 — err + 검증 대상 수정', (reason, kind) => {
    const v = roleVerdict(kind, { status: 'INVALID', fail_reason: reason });
    expect(v.tone).toBe('err');
    expect(v.action).toEqual({ kind: 'edit', role: kind, label: '수정하기' });
  });

  it.each(['SCAN_ROLE_NOT_CONFIGURED', 'SCAN_ROLE_NOT_ASSUMABLE'])(
    '%s 는 execution 검증의 실패지만 조치 대상은 Scan Role 이다',
    (reason) => {
      const v = roleVerdict('execution', { status: 'INVALID', fail_reason: reason });
      expect(v.action?.kind).toBe('edit');
      expect(v.action?.role).toBe('scan');
      // The supporting line explains the target switch — a button that just changes says nothing.
      expect(v.note).not.toBeNull();
    },
  );

  it('판정 불가는 실패가 아니다 — warn + 재조회 (수정 CTA 를 주지 않는다)', () => {
    const v = roleVerdict('scan', {
      status: 'UNVERIFIED',
      fail_reason: 'ROLE_VERIFICATION_UNAVAILABLE',
    });
    expect(v.tone).toBe('warn');
    expect(v.action).toEqual({ kind: 'retry', label: '다시 확인' });
  });

  it('VALID 은 할 말이 없다 — 안내 박스를 그리지 않는다', () => {
    const v = roleVerdict('scan', { status: 'VALID', role_arn: 'arn:aws:iam::1:role/X' });
    expect(v.tone).toBe('ok');
    expect(v.message).toBeNull();
    expect(v.action).toBeNull();
  });
});

describe('roleVerdict — 맵에 없는 코드', () => {
  it('status 로 판정하고 코드는 그대로 남긴다 (판정 불가로 뭉개지 않는다)', () => {
    const v = roleVerdict('scan', { status: 'INVALID', fail_reason: 'ROLE_SESSION_POLICY_DENIED' });
    // The server already settled on INVALID, so saying "could not determine" would be a lie.
    expect(v.tone).toBe('err');
    expect(v.rawCode).toBe('ROLE_SESSION_POLICY_DENIED');
  });

  it('담을 문장이 없어도 박스는 떠야 한다 — 아니면 코드가 화면에서 사라진다', () => {
    const v = roleVerdict('scan', { status: 'WEIRD', fail_reason: 'BRAND_NEW_CODE' });
    expect(v.message).not.toBeNull();
    expect(v.rawCode).toBe('BRAND_NEW_CODE');
  });

  it('GCP·Azure 는 자기 코드 체계를 쓰지만 fail_message 로 계속 말한다', () => {
    const v = roleVerdict('scan', {
      status: 'INVALID',
      fail_reason: 'SA_INSUFFICIENT_PERMISSIONS',
      fail_message: '서비스 계정에 필요한 권한이 없습니다.',
    });
    expect(v.tone).toBe('err');
    expect(v.message).toBe('서비스 계정에 필요한 권한이 없습니다.');
    expect(v.rawCode).toBe('SA_INSUFFICIENT_PERMISSIONS');
  });
});
