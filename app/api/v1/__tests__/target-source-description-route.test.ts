import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      putDescription: vi.fn(),
    },
  },
}));

import { PUT } from '@/app/api/v1/target-sources/[targetSourceId]/description/route';
import { bff } from '@/lib/bff/client';

const mockedPut = vi.mocked(bff.targetSources.putDescription);

const call = (id: string, body: unknown) =>
  PUT(
    new Request(`http://localhost/pass/api/v1/target-sources/${id}/description`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ targetSourceId: id }) },
  );

describe('PUT /pass/api/v1/target-sources/[targetSourceId]/description', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPut.mockResolvedValue({ target_source_id: 1013, description: '수정된 설명' });
  });

  it('description 을 그대로 실어 보낸다', async () => {
    const response = await call('1013', { description: '수정된 설명' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ description: '수정된 설명' });
    expect(mockedPut).toHaveBeenCalledWith(1013, '수정된 설명');
  });

  it('빈 문자열은 유효한 값이다 — 설명 지우기가 400 이 되면 안 된다', async () => {
    mockedPut.mockResolvedValue({ target_source_id: 1013, description: '' });
    const response = await call('1013', { description: '' });

    expect(response.status).toBe(200);
    expect(mockedPut).toHaveBeenCalledWith(1013, '');
  });

  it('description 이 문자열이 아니면 VALIDATION_FAILED', async () => {
    const response = await call('1013', { description: 42 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('1000자는 통과한다 — 경계값이 한 글자 차이로 막히면 안 된다', async () => {
    const exact = 'x'.repeat(1000);
    mockedPut.mockResolvedValue({ target_source_id: 1013, description: exact });
    const response = await call('1013', { description: exact });

    expect(response.status).toBe(200);
    expect(mockedPut).toHaveBeenCalledWith(1013, exact);
  });

  it('1000자를 넘으면 VALIDATION_FAILED — 잘라 보내지 않는다', async () => {
    const response = await call('1013', { description: 'x'.repeat(1001) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('잘못된 targetSourceId면 업스트림까지 가지 않는다', async () => {
    const response = await call('abc', { description: 'x' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_PARAMETER' });
    expect(mockedPut).not.toHaveBeenCalled();
  });
});
