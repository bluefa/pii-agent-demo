import { afterEach, describe, it, expect, vi } from 'vitest';
import { errorStack, logAccess, logError } from '@/app/api/_lib/log';
import { handleUnexpectedError } from '@/app/api/_lib/problem';

const lastLine = (spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> => {
  const calls = spy.mock.calls;
  const arg = calls[calls.length - 1]?.[0];
  return JSON.parse(String(arg));
};

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits a single valid JSON line with ERROR severity and fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logError('boom stack here', { requestId: 'req-1', source: 'browser' });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = lastLine(spy);
    expect(line.severity).toBe('ERROR');
    expect(line.message).toBe('boom stack here');
    expect(line.requestId).toBe('req-1');
    expect(line.source).toBe('browser');
    expect(typeof line.time).toBe('string');
  });

  it('omits undefined fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logError('msg', { requestId: 'req-2', page: undefined });

    const line = lastLine(spy);
    expect(line.requestId).toBe('req-2');
    expect('page' in line).toBe(false);
  });
});

describe('logAccess', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits a single valid JSON line with INFO severity and access fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logAccess({ method: 'GET', path: '/api/v1/x', status: 200, durationMs: 12, requestId: 'req-3' });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = lastLine(spy);
    expect(line.severity).toBe('INFO');
    expect(line.method).toBe('GET');
    expect(line.path).toBe('/api/v1/x');
    expect(line.status).toBe(200);
    expect(line.durationMs).toBe(12);
    expect(line.requestId).toBe('req-3');
  });
});

describe('errorStack', () => {
  it('returns the full stack for an Error', () => {
    const err = new Error('nope');
    expect(errorStack(err)).toBe(err.stack);
  });

  it('falls back to a stable string for a non-Error throw', () => {
    expect(errorStack('plain string')).toBe('Non-Error thrown: plain string');
  });
});

describe('handleUnexpectedError logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the error stack with the requestId at ERROR severity', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = new Error('kaboom');

    handleUnexpectedError(err, 'req-99');

    const line = lastLine(spy);
    expect(line.severity).toBe('ERROR');
    expect(line.message).toBe(err.stack);
    expect(line.message).toContain('kaboom');
    expect(line.requestId).toBe('req-99');
  });
});
