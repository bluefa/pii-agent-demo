import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    aws: {
      verifyScanRole: vi.fn(),
      verifyExecutionRole: vi.fn(),
    },
  },
}));

import { GET as getScanRole } from '@/app/api/v1/aws/target-sources/[targetSourceId]/verify-scan-role/route';
import { GET as getExecutionRole } from '@/app/api/v1/aws/target-sources/[targetSourceId]/verify-execution-role/route';
import { bff } from '@/lib/bff/client';

const mockedVerifyScanRole = vi.mocked(bff.aws.verifyScanRole);
const mockedVerifyExecutionRole = vi.mocked(bff.aws.verifyExecutionRole);

describe('GET /integration/api/v1/aws/target-sources/[targetSourceId]/verify-scan-role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AwsRoleVerificationResponse를 snake wire로 통과시킨다', async () => {
    // BFF returns snake wire; route validates with schemas.AwsRoleVerificationResponse.parse().
    mockedVerifyScanRole.mockResolvedValue({
      status: 'VALID',
      role_arn: 'arn:aws:iam::123:role/scan',
      last_verified_at: '2026-06-23T10:00:00Z',
    });

    const response = await getScanRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/42/verify-scan-role'),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'VALID',
      role_arn: 'arn:aws:iam::123:role/scan',
      last_verified_at: '2026-06-23T10:00:00Z',
    });
    expect(mockedVerifyScanRole).toHaveBeenCalledWith(42);
  });

  it('잘못된 targetSourceId는 problem 응답으로 거절한다', async () => {
    const response = await getScanRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/abc/verify-scan-role'),
      { params: Promise.resolve({ targetSourceId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    expect(mockedVerifyScanRole).not.toHaveBeenCalled();
  });
});

describe('GET /integration/api/v1/aws/target-sources/[targetSourceId]/verify-execution-role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('실패한 execution-role 검증 결과를 snake wire로 통과시킨다', async () => {
    mockedVerifyExecutionRole.mockResolvedValue({
      status: 'INVALID',
      role_arn: 'arn:aws:iam::123:role/exec',
      fail_reason: 'ROLE_NOT_FOUND',
      fail_message: 'Execution role is not assumable.',
      last_verified_at: '2026-06-23T10:00:00Z',
    });

    const response = await getExecutionRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/42/verify-execution-role'),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'INVALID',
      role_arn: 'arn:aws:iam::123:role/exec',
      fail_reason: 'ROLE_NOT_FOUND',
      fail_message: 'Execution role is not assumable.',
      last_verified_at: '2026-06-23T10:00:00Z',
    });
    expect(mockedVerifyExecutionRole).toHaveBeenCalledWith(42);
  });

  it('잘못된 targetSourceId는 problem 응답으로 거절한다', async () => {
    const response = await getExecutionRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/abc/verify-execution-role'),
      { params: Promise.resolve({ targetSourceId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    expect(mockedVerifyExecutionRole).not.toHaveBeenCalled();
  });
});
