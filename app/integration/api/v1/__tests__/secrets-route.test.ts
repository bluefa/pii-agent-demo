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

  it('ADR-019: snake SecretResponse wire를 그대로 반환한다 (getSnakeRaw)', async () => {
    // ADR-019: getSnakeRaw bypasses camelCaseKeys; route validates with
    // z.array(schemas.SecretResponse).parse and returns snake wire to CSR.
    // CSR getSecrets (app/lib/api/index.ts) does the snake→camel mapping.
    mockedGetSecrets.mockResolvedValue([
      { name: 'cred-a', create_time: 1700000000000, create_time_str: '2026-03-01T00:00:00Z' },
    ] as never);

    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { name: 'cred-a', create_time: 1700000000000, create_time_str: '2026-03-01T00:00:00Z' },
    ]);
  });

  it('ADR-019: snake SecretResponse array를 그대로 통과시킨다 (passthrough)', async () => {
    mockedGetSecrets.mockResolvedValue([
      { name: 'cred-b', create_time: 1700000000001, create_time_str: '2026-03-02T00:00:00Z' },
    ] as never);

    const response = await call();

    await expect(response.json()).resolves.toEqual([
      { name: 'cred-b', create_time: 1700000000001, create_time_str: '2026-03-02T00:00:00Z' },
    ]);
  });

  it('ADR-019: array가 아닌 응답은 빈 배열로 폴백한다', async () => {
    // If BFF returns non-array (e.g. envelope), route returns empty array.
    mockedGetSecrets.mockResolvedValue({ credentials: [] } as never);

    const response = await call();

    await expect(response.json()).resolves.toEqual([]);
  });
});
