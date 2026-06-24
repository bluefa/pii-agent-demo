import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    aws: {
      verifyScanRole: vi.fn(),
      verifyExecutionRole: vi.fn(),
    },
  },
}));

import { GET as getScanRole } from '@/app/integration/api/v1/aws/target-sources/[targetSourceId]/verify-scan-role/route';
import { GET as getExecutionRole } from '@/app/integration/api/v1/aws/target-sources/[targetSourceId]/verify-execution-role/route';
import { bff } from '@/lib/bff/client';

const mockedVerifyScanRole = vi.mocked(bff.aws.verifyScanRole);
const mockedVerifyExecutionRole = vi.mocked(bff.aws.verifyExecutionRole);

describe('GET /integration/api/v1/aws/target-sources/[targetSourceId]/verify-scan-role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AwsRoleVerificationResponse를 그대로 통과시킨다', async () => {
    // swagger AwsRoleVerificationResponse: status/fail_reason are free strings.
    mockedVerifyScanRole.mockResolvedValue({
      status: 'VALID',
      roleArn: 'arn:aws:iam::123:role/scan',
      failReason: undefined,
      failMessage: undefined,
      lastVerifiedAt: '2026-06-23T10:00:00Z',
    });

    const response = await getScanRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/42/verify-scan-role'),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'VALID',
      roleArn: 'arn:aws:iam::123:role/scan',
      lastVerifiedAt: '2026-06-23T10:00:00Z',
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

  it('실패한 execution-role 검증 결과를 그대로 통과시킨다', async () => {
    mockedVerifyExecutionRole.mockResolvedValue({
      status: 'INVALID',
      roleArn: 'arn:aws:iam::123:role/exec',
      failReason: 'ROLE_NOT_FOUND',
      failMessage: 'Execution role is not assumable.',
      lastVerifiedAt: '2026-06-23T10:00:00Z',
    });

    const response = await getExecutionRole(
      new Request('http://localhost/integration/api/v1/aws/target-sources/42/verify-execution-role'),
      { params: Promise.resolve({ targetSourceId: '42' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'INVALID',
      roleArn: 'arn:aws:iam::123:role/exec',
      failReason: 'ROLE_NOT_FOUND',
      failMessage: 'Execution role is not assumable.',
      lastVerifiedAt: '2026-06-23T10:00:00Z',
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
