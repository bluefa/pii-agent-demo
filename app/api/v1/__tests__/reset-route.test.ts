import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: { confirm: { resetTargetSource: vi.fn() } },
}));

import { POST as reset } from '@/app/api/v1/target-sources/[targetSourceId]/reset/route';
import { bff } from '@/lib/bff/client';

const mockedReset = vi.mocked(bff.confirm.resetTargetSource);

const post = (body: string, targetSourceId = '42') =>
  reset(new Request('http://localhost/x', { method: 'POST', body }), {
    params: Promise.resolve({ targetSourceId }),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST …/reset', () => {
  it('forwards the trimmed reason and returns the ApprovalActionResponseDto', async () => {
    mockedReset.mockResolvedValue({
      request_id: 42,
      status: 'RESET',
      processed_by: { user_id: 'admin@corp' },
      processed_at: '2026-08-11T00:00:00Z',
      reason: '운영 DB를 신규 VPC로 이전합니다.',
    });

    const response = await post(JSON.stringify({ reason: '  운영 DB를 신규 VPC로 이전합니다.  ' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'RESET' });
    expect(mockedReset).toHaveBeenCalledWith(42, { reason: '운영 DB를 신규 VPC로 이전합니다.' });
  });

  /**
   * 계약은 reason 을 required 로 두지만 생성된 zod 는 `.partial()` 이라 빈 몸통도 통과한다.
   * 초기화는 끝난 설치와 승인을 버리는 조작이고 사유는 그 감사 기록이다 — 화면이 입력을
   * 강제하는 것과 별개로, 경계를 직접 부르는 호출이 사유 없이 지나가면 안 된다.
   */
  it.each([
    ['no body at all', '{}'],
    ['malformed JSON', 'not-json'],
    ['an explicitly empty reason', JSON.stringify({ reason: '' })],
    ['a whitespace-only reason', JSON.stringify({ reason: '   ' })],
  ])('rejects %s without dispatching to the BFF', async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(mockedReset).not.toHaveBeenCalled();
  });

  /**
   * `.parse` 는 타입이 어긋난 몸통에 ZodError 를 던지고 withV1 은 BffError 만 매핑한다 —
   * 그대로 두면 잘못 보낸 쪽의 오류가 500(서버 장애)으로 답해진다.
   */
  it.each([
    ['a non-string reason', JSON.stringify({ reason: 42 })],
    ['a JSON array body', JSON.stringify([{ reason: '사유' }])],
    ['a bare JSON string body', JSON.stringify('사유')],
  ])('answers 400, not 500, for %s', async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it('rejects a reason past the contract maxLength', async () => {
    const response = await post(JSON.stringify({ reason: 'x'.repeat(1001) }));
    expect(response.status).toBe(400);
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it('accepts a reason exactly at the maxLength', async () => {
    mockedReset.mockResolvedValue({ request_id: 42, status: 'RESET' });
    const response = await post(JSON.stringify({ reason: 'x'.repeat(1000) }));
    expect(response.status).toBe(200);
    expect(mockedReset).toHaveBeenCalledOnce();
  });

  it('maps a BffError to ProblemDetails', async () => {
    mockedReset.mockRejectedValue(new BffError(409, 'CONFLICT', '이미 초기 상태'));
    const response = await post(JSON.stringify({ reason: '사유' }));
    expect(response.status).toBe(409);
  });

  it('rejects a non-numeric targetSourceId before reading the body', async () => {
    const response = await post(JSON.stringify({ reason: '사유' }), 'abc');
    expect(response.status).toBe(400);
    expect(mockedReset).not.toHaveBeenCalled();
  });
});
