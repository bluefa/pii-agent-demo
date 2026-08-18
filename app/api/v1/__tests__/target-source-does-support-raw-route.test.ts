import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      setDoesSupportRaw: vi.fn(),
    },
  },
}));

import { PUT } from '@/app/api/v1/target-sources/[targetSourceId]/does-support-raw/route';
import { bff } from '@/lib/bff/client';

const mockedPut = vi.mocked(bff.targetSources.setDoesSupportRaw);

const call = (id: string, body: unknown) =>
  PUT(
    new Request(`http://localhost/pass/api/v1/target-sources/${id}/does-support-raw`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ targetSourceId: id }) },
  );

describe('PUT /pass/api/v1/target-sources/[targetSourceId]/does-support-raw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPut.mockResolvedValue(undefined);
  });

  it('두 값 모두 그대로 실어 보낸다 — 끄는 쪽이 조용히 빠지면 안 된다', async () => {
    const on = await call('1013', { enabled: true });
    expect(on.status).toBe(204);
    expect(mockedPut).toHaveBeenCalledWith(1013, true);

    const off = await call('1013', { enabled: false });
    expect(off.status).toBe(204);
    expect(mockedPut).toHaveBeenLastCalledWith(1013, false);
  });

  it('enabled 가 boolean 이 아니면 VALIDATION_FAILED', async () => {
    // 'true' 나 1 이 통과하면 업스트림 경로가 잘못 골라진다 (enabled ↔ disabled).
    for (const bad of ['true', 1, null, undefined]) {
      const response = await call('1013', { enabled: bad });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_FAILED' });
    }
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it('잘못된 targetSourceId면 업스트림까지 가지 않는다', async () => {
    const response = await call('abc', { enabled: true });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_PARAMETER' });
    expect(mockedPut).not.toHaveBeenCalled();
  });
});
