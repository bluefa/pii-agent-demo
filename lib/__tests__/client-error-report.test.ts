// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

describe('reportClientError throttle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('dedupes an identical message within 30s, then allows it again', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { reportClientError } = await import('@/lib/client-error-report');

    reportClientError({ type: 'boundary', message: 'same' });
    reportClientError({ type: 'boundary', message: 'same' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);
    reportClientError({ type: 'boundary', message: 'same' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('caps at 10 reports per minute across distinct messages', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { reportClientError } = await import('@/lib/client-error-report');

    for (let i = 0; i < 10; i += 1) {
      reportClientError({ type: 'boundary', message: `msg-${i}` });
    }
    expect(fetchSpy).toHaveBeenCalledTimes(10);

    reportClientError({ type: 'boundary', message: 'msg-over' });
    expect(fetchSpy).toHaveBeenCalledTimes(10);
  });

  it('prunes stale dedupe entries on window rotation so the map stays bounded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const { reportClientError, __dedupeSizeForTest } = await import('@/lib/client-error-report');

    // Fill the dedupe map with 10 distinct messages in window 1.
    for (let i = 0; i < 10; i += 1) {
      reportClientError({ type: 'boundary', message: `w1-${i}` });
    }
    expect(__dedupeSizeForTest()).toBe(10);

    // Rotate past the minute window; all window-1 entries are now older than the
    // dedupe window and are pruned on the next report.
    vi.advanceTimersByTime(61_000);
    reportClientError({ type: 'boundary', message: 'w2-fresh' });
    expect(__dedupeSizeForTest()).toBe(1);
  });

  it('POSTs to the internal ingest path and swallows fetch rejections', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { reportClientError } = await import('@/lib/client-error-report');

    expect(() => reportClientError({ type: 'global', message: 'x' })).not.toThrow();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/integration/api/v1/observability/client-errors',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });
});

describe('installGlobalErrorHandlers idempotence', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers window listeners exactly once across repeated calls', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { installGlobalErrorHandlers } = await import('@/lib/client-error-report');

    installGlobalErrorHandlers();
    installGlobalErrorHandlers();
    installGlobalErrorHandlers();

    const registered = addSpy.mock.calls.map((call) => call[0]);
    expect(registered.filter((t) => t === 'error')).toHaveLength(1);
    expect(registered.filter((t) => t === 'unhandledrejection')).toHaveLength(1);
  });
});
