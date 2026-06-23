import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      getSecrets: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/target-sources/[targetSourceId]/secrets/route';
import { bff } from '@/lib/bff/client';

const mockedGetSecrets = vi.mocked(bff.targetSources.getSecrets);

const call = () =>
  GET(new Request('http://localhost/integration/api/v1/target-sources/1003/secrets'), {
    params: Promise.resolve({ targetSourceId: '1003' }),
  });

describe('GET /integration/api/v1/target-sources/[targetSourceId]/secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('camelCased real-BFF wire(createTimeStr)에서 SecretKey를 만든다 (ADR-019 D-5)', async () => {
    // httpBff `get` camelCaseKeys the swagger SecretResponse → createTimeStr.
    mockedGetSecrets.mockResolvedValue([
      { name: 'cred-a', createTime: 1700000000000, createTimeStr: '2026-03-01T00:00:00Z' },
    ] as never);

    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { name: 'cred-a', createTimeStr: '2026-03-01T00:00:00Z' },
    ]);
  });

  it('snake mock wire(create_time_str)도 SecretKey로 변환한다', async () => {
    mockedGetSecrets.mockResolvedValue([
      { name: 'cred-b', create_time: 1700000000000, create_time_str: '2026-03-02T00:00:00Z' },
    ] as never);

    const response = await call();

    await expect(response.json()).resolves.toEqual([
      { name: 'cred-b', createTimeStr: '2026-03-02T00:00:00Z' },
    ]);
  });

  it('{credentials} envelope에서 databaseType label을 부착한다', async () => {
    mockedGetSecrets.mockResolvedValue({
      credentials: [
        { name: 'cred-c', createTimeStr: '2026-03-03T00:00:00Z', databaseType: 'MYSQL' },
      ],
    } as never);

    const response = await call();

    await expect(response.json()).resolves.toEqual([
      { name: 'cred-c', createTimeStr: '2026-03-03T00:00:00Z', labels: { databaseType: 'MYSQL' } },
    ]);
  });
});
