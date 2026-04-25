import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    guides: {
      get: vi.fn(),
      put: vi.fn(),
    },
  },
}));

import { GET, PUT } from '@/app/integration/api/v1/admin/guides/[name]/route';
import { bff } from '@/lib/bff/client';

const mockedGet = vi.mocked(bff.guides.get);
const mockedPut = vi.mocked(bff.guides.put);

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
      'http://localhost/integration/api/v1/admin/guides/AZURE_APPLYING',
      { headers: { 'x-request-id': 'req-test-1' } },
    );
    const res = await GET(req, { params: Promise.resolve({ name: 'AZURE_APPLYING' }) });
    expect(mockedGet).toHaveBeenCalledWith('AZURE_APPLYING');
    expect(mockedPut).not.toHaveBeenCalled();
    expect(res.headers.get('x-expected-duration')).toBe('100ms ~ 500ms');
    expect(res.headers.get('x-request-id')).toBe('req-test-1');
  });

  it('PUT dispatches to bff.guides.put with the parsed body', async () => {
    mockedPut.mockResolvedValue({
      name: 'AWS_APPLYING',
      contents: { ko: '<p>k</p>', en: '<p>e</p>' },
      updated_at: '2026-04-25T00:00:00Z',
    });
    const req = new Request(
      'http://localhost/integration/api/v1/admin/guides/AWS_APPLYING',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-test-2' },
        body: JSON.stringify({ contents: { ko: '<p>k</p>', en: '<p>e</p>' } }),
      },
    );
    const res = await PUT(req, { params: Promise.resolve({ name: 'AWS_APPLYING' }) });
    expect(mockedPut).toHaveBeenCalledWith('AWS_APPLYING', {
      contents: { ko: '<p>k</p>', en: '<p>e</p>' },
    });
    expect(res.headers.get('x-expected-duration')).toBe('200ms ~ 1s');
    expect(res.headers.get('x-request-id')).toBe('req-test-2');
  });

  it('PUT forwards null when the body is not JSON (thin dispatch — mock layer validates)', async () => {
    mockedPut.mockResolvedValue({
      name: 'AWS_APPLYING',
      contents: { ko: '', en: '' },
      updated_at: '2026-04-25T00:00:00Z',
    });
    const req = new Request(
      'http://localhost/integration/api/v1/admin/guides/AWS_APPLYING',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      },
    );
    await PUT(req, { params: Promise.resolve({ name: 'AWS_APPLYING' }) });
    expect(mockedPut).toHaveBeenCalledWith('AWS_APPLYING', null);
  });
});
