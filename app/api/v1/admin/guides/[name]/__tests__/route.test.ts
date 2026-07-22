import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    guides: {
      get: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/admin/guides/[name]/route';
import { bff } from '@/lib/bff/client';

const mockedGet = vi.mocked(bff.guides.get);

describe('admin/guides/[name] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET dispatches to bff.guides.get with the resolved name', async () => {
    mockedGet.mockResolvedValue({
      name: 'AZURE_APPLYING',
      contents: { ko: '', en: '' },
      updatedAt: '1970-01-01T00:00:00Z',
    });
    const req = new Request(
      'http://localhost/pass/api/v1/admin/guides/AZURE_APPLYING',
      { headers: { 'x-request-id': 'req-test-1' } },
    );
    const res = await GET(req, { params: Promise.resolve({ name: 'AZURE_APPLYING' }) });
    expect(mockedGet).toHaveBeenCalledWith('AZURE_APPLYING');
    expect(res.headers.get('x-expected-duration')).toBe('100ms ~ 500ms');
    expect(res.headers.get('x-request-id')).toBe('req-test-1');
  });
});
