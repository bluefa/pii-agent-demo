/**
 * Route dispatch tests.
 *
 * Asserts the handler behaves as a thin dispatcher:
 *  - GET invokes `client.guides.get(name)`
 *  - PUT parses JSON and invokes `client.guides.put(name, body)`
 *  - `withV1` adds the `x-expected-duration` metadata header
 */

import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guidesGet = vi.fn();
const guidesPut = vi.fn();

vi.mock('@/lib/api-client', () => ({
  client: {
    guides: {
      get: (name: string) => guidesGet(name),
      put: (name: string, body: unknown) => guidesPut(name, body),
    },
  },
}));

describe('admin/guides/[name] route', () => {
  beforeEach(() => {
    guidesGet.mockReset();
    guidesPut.mockReset();
  });

  it('GET dispatches to client.guides.get with the resolved name', async () => {
    guidesGet.mockResolvedValue(NextResponse.json({ ok: true }));
    const mod = await import('@/app/integration/api/v1/admin/guides/[name]/route');
    const req = new Request(
      'http://localhost/integration/api/v1/admin/guides/AZURE_APPLYING',
      { headers: { 'x-request-id': 'req-test-1' } },
    );
    const res = await mod.GET(req, { params: Promise.resolve({ name: 'AZURE_APPLYING' }) });
    expect(guidesGet).toHaveBeenCalledWith('AZURE_APPLYING');
    expect(guidesPut).not.toHaveBeenCalled();
    expect(res.headers.get('x-expected-duration')).toBe('100ms ~ 500ms');
    expect(res.headers.get('x-request-id')).toBe('req-test-1');
  });

  it('PUT dispatches to client.guides.put with the parsed body', async () => {
    guidesPut.mockResolvedValue(NextResponse.json({ ok: true }));
    const mod = await import('@/app/integration/api/v1/admin/guides/[name]/route');
    const req = new Request(
      'http://localhost/integration/api/v1/admin/guides/AWS_APPLYING',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-test-2' },
        body: JSON.stringify({ contents: { ko: '<p>k</p>', en: '<p>e</p>' } }),
      },
    );
    const res = await mod.PUT(req, { params: Promise.resolve({ name: 'AWS_APPLYING' }) });
    expect(guidesPut).toHaveBeenCalledWith('AWS_APPLYING', {
      contents: { ko: '<p>k</p>', en: '<p>e</p>' },
    });
    expect(res.headers.get('x-expected-duration')).toBe('200ms ~ 1s');
    expect(res.headers.get('x-request-id')).toBe('req-test-2');
  });

  it('PUT forwards null when the body is not JSON (thin dispatch — mock layer validates)', async () => {
    guidesPut.mockResolvedValue(NextResponse.json({ ok: true }));
    const mod = await import('@/app/integration/api/v1/admin/guides/[name]/route');
    const req = new Request(
      'http://localhost/integration/api/v1/admin/guides/AWS_APPLYING',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      },
    );
    await mod.PUT(req, { params: Promise.resolve({ name: 'AWS_APPLYING' }) });
    expect(guidesPut).toHaveBeenCalledWith('AWS_APPLYING', null);
  });
});
