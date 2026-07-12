import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const post = (body: string): Request =>
  new Request('http://localhost/integration/api/v1/observability/client-errors', {
    method: 'POST',
    body,
  });

const parsedLines = (spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> =>
  spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])) as Record<string, unknown>);

describe('POST /observability/client-errors', () => {
  beforeEach(() => {
    // Fresh module → reset the per-instance fixed-window rate counters.
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid report, logs it at ERROR, and responds 204', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const breadcrumbs = [{
      method: 'GET',
      path: '/integration/api/v1/x',
      status: 500,
      durationMs: 5,
      requestId: '11111111-1111-4111-8111-111111111111',
    }];
    const res = await POST(
      post(JSON.stringify({
        type: 'boundary',
        message: 'boom',
        stack: 'Error: boom\n at x',
        page: '/services',
        digest: 'd-42',
        breadcrumbs,
      })),
    );

    expect(res.status).toBe(204);
    const lines = parsedLines(spy);
    expect(lines).toHaveLength(1);
    expect(lines[0].severity).toBe('ERROR');
    expect(lines[0].source).toBe('browser');
    expect(lines[0].page).toBe('/services');
    expect(lines[0].type).toBe('boundary');
    expect(lines[0].digest).toBe('d-42');
    expect(lines[0].breadcrumbs).toEqual(breadcrumbs);
    expect(String(lines[0].message)).toContain('Error: boom');
  });

  it('rebuilds breadcrumbs from an allowlist — drops nested/unknown props, invalid entries, and query strings', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const res = await POST(
      post(JSON.stringify({
        type: 'boundary',
        message: 'boom',
        breadcrumbs: [
          // extra/nested props stripped; query stripped; bad requestId dropped
          { method: 'GET', path: '/api/x?token=secret', status: 200, durationMs: 3, requestId: 'nope', evil: { a: 1 } },
          // malformed (no numeric status) → entry dropped
          { method: 'GET', path: '/api/y', status: 'oops', durationMs: 3 },
          // not an object → dropped
          'DROP ME',
        ],
      })),
    );

    expect(res.status).toBe(204);
    const [line] = parsedLines(spy);
    expect(line.breadcrumbs).toEqual([
      { method: 'GET', path: '/api/x', status: 200, durationMs: 3 },
    ]);
  });

  it('caps breadcrumbs at 10 entries', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const many = Array.from({ length: 25 }, (_, i) => ({
      method: 'GET', path: `/api/${i}`, status: 200, durationMs: 1,
    }));
    await POST(post(JSON.stringify({ type: 'boundary', message: 'boom', breadcrumbs: many })));

    const [line] = parsedLines(spy);
    expect((line.breadcrumbs as unknown[]).length).toBe(10);
  });

  it('rejects a multibyte body whose byte length exceeds the cap (char length under it)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    // 20k '한' chars = ~20k chars (< 32Ki) but ~60k UTF-8 bytes (> 32Ki).
    const multibyte = JSON.stringify({ message: '한'.repeat(20_000) });
    expect(multibyte.length).toBeLessThan(32 * 1024);
    const res = await POST(post(multibyte));

    expect(res.status).toBe(413);
  });

  it('rejects an oversize body with 413 and an empty response', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const huge = JSON.stringify({ message: 'x'.repeat(33 * 1024) });
    const res = await POST(post(huge));

    expect(res.status).toBe(413);
    expect(await res.text()).toBe('');
  });

  it('rejects malformed JSON with 400', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('');
  });

  it('rejects a body missing a string message with 400', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    const res = await POST(post(JSON.stringify({ type: 'boundary' })));
    expect(res.status).toBe(400);
  });

  it('drops reports past the per-minute cap (silent 204, no extra ERROR log)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { POST } = await import('@/app/api/v1/observability/client-errors/route');

    for (let i = 0; i < 60; i += 1) {
      const res = await POST(post(JSON.stringify({ type: 'boundary', message: `e-${i}` })));
      expect(res.status).toBe(204);
    }
    const dropped = await POST(post(JSON.stringify({ type: 'boundary', message: 'over-cap' })));
    expect(dropped.status).toBe(204);

    const lines = parsedLines(spy);
    const errorLines = lines.filter((l) => l.severity === 'ERROR');
    const infoLines = lines.filter((l) => l.severity === 'INFO');
    expect(errorLines).toHaveLength(60);
    // exactly one INFO line when the cap first trips this window
    expect(infoLines).toHaveLength(1);
    expect(errorLines.some((l) => l.message === 'over-cap')).toBe(false);
  });
});
