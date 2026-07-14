import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

// In-request-scope: mock next/headers so the forwarder reads inbound values.
vi.mock('next/headers', () => ({ headers: vi.fn() }));

import { headers } from 'next/headers';

const setInbound = (map: Record<string, string>): void => {
  vi.mocked(headers).mockResolvedValue(
    new Headers(map) as unknown as Awaited<ReturnType<typeof headers>>,
  );
};

const forwardedFromGet = async (): Promise<Headers> => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ id: 'u1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  const { httpBff } = await import('@/lib/bff/http');
  await httpBff.users.me();
  const init = fetchSpy.mock.calls[0][1] as RequestInit;
  return new Headers(init.headers);
};

describe('httpBff forwards a validated, clamped observability allowlist', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BFF_API_URL = 'https://bff.example.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BFF_API_URL;
  });

  it('forwards a valid request-id and client-page', async () => {
    setInbound({ 'x-request-id': '3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'x-client-page': '/services' });
    const sent = await forwardedFromGet();
    expect(sent.get('x-request-id')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(sent.get('x-client-page')).toBe('/services');
    expect(sent.get('accept')).toBe('application/json');
  });

  it('drops an invalid request-id', async () => {
    setInbound({ 'x-request-id': 'not a valid id!!', 'x-client-page': '/services' });
    const sent = await forwardedFromGet();
    expect(sent.get('x-request-id')).toBeNull();
    expect(sent.get('x-client-page')).toBe('/services');
  });

  it('never forwards a non-allowlisted header', async () => {
    setInbound({ 'x-request-id': '3f2504e0-4f89-41d3-9a0c-0305e82c3301', authorization: 'Bearer secret' });
    const sent = await forwardedFromGet();
    expect(sent.get('authorization')).toBeNull();
    expect(sent.get('x-request-id')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('clamps an oversized client-page to 256 chars', async () => {
    setInbound({ 'x-client-page': '/'.padEnd(500, 'a') });
    const sent = await forwardedFromGet();
    expect(sent.get('x-client-page')?.length).toBe(256);
  });
});
