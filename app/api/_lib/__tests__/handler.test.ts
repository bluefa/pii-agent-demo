import { afterEach, describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { BffError } from '@/lib/bff/errors';

const makeRequest = () => new Request('http://localhost/test');
const makeParams = (params: Record<string, string> = {}) =>
  ({ params: Promise.resolve(params) });

describe('withV1', () => {
  it('성공 응답에 x-request-id 헤더를 추가한다', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.status).toBe(200);
  });

  it('expectedDuration 옵션이 있으면 x-expected-duration 헤더를 추가한다', async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withV1(handler, { expectedDuration: '200ms' });

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.headers.get('x-expected-duration')).toBe('200ms');
  });

  it('핸들러가 throw하면 INTERNAL_ERROR problem response를 반환한다', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });

  it('non-ok 응답을 ProblemDetails 형식으로 변환한다', async () => {
    const errorResponse = NextResponse.json(
      { error: 'NOT_FOUND', message: 'not found' },
      { status: 404 },
    );
    const handler = vi.fn().mockResolvedValue(errorResponse);
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('TARGET_SOURCE_NOT_FOUND');
    expect(body.type).toContain('https://pii-agent.dev/problems/');
  });

  it('throw된 BffError를 ProblemDetails로 변환한다 (transformLegacyError와 동일 매핑)', async () => {
    const handler = vi.fn().mockRejectedValue(
      new BffError(404, 'NOT_FOUND', 'target source missing'),
    );
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const body = await response.json();
    expect(body.code).toBe('TARGET_SOURCE_NOT_FOUND');
    expect(body.detail).toBe('target source missing');
    expect(body.status).toBe(404);
    expect(body.type).toBe('https://pii-agent.dev/problems/TARGET_SOURCE_NOT_FOUND');
  });

  it('throw된 BffError(403)는 FORBIDDEN ProblemDetails로 변환한다', async () => {
    const handler = vi.fn().mockRejectedValue(
      new BffError(403, 'FORBIDDEN', '권한 없음'),
    );
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('FORBIDDEN');
    expect(body.detail).toBe('권한 없음');
  });

  it('이미 problem+json인 응답은 재변환하지 않고 헤더만 추가한다', async () => {
    const problemBody = {
      type: 'https://pii-agent.dev/problems/FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: '권한이 없습니다.',
      code: 'FORBIDDEN',
      retriable: false,
      requestId: 'test-req',
    };
    const problemResp = NextResponse.json(problemBody, {
      status: 403,
      headers: { 'content-type': 'application/problem+json' },
    });
    const handler = vi.fn().mockResolvedValue(problemResp);
    const wrapped = withV1(handler);

    const response = await wrapped(makeRequest(), makeParams());

    expect(response.status).toBe(403);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const body = await response.json();
    // Should preserve original problem, not re-wrap as INTERNAL_ERROR
    expect(body.code).toBe('FORBIDDEN');
    expect(body.detail).toBe('권한이 없습니다.');
  });
});

describe('withV1 observability logging', () => {
  afterEach(() => vi.restoreAllMocks());

  const logLines = (spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> =>
    spy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])) as Record<string, unknown>);

  it('emits an ERROR log for an upstream 5xx BffError, preserving the upstream status', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue(new BffError(502, 'BAD_GATEWAY', 'upstream down'));

    await withV1(handler)(makeRequest(), makeParams());

    const errorLines = logLines(spy).filter((l) => l.severity === 'ERROR');
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0].status).toBe(502);
    expect(errorLines[0].context).toBe('bff-upstream');
    expect(errorLines[0].method).toBe('GET');
  });

  it('emits an ERROR log when an upstream 500 maps to a non-5xx problem code', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue(new BffError(500, 'ALREADY_EXISTS', 'dup'));

    const res = await withV1(handler)(makeRequest(), makeParams());
    const body = await res.json();
    expect(body.code).toBe('CONFLICT_IN_PROGRESS'); // ALREADY_EXISTS → 409 problem

    const errorLines = logLines(spy).filter((l) => l.severity === 'ERROR');
    expect(errorLines).toHaveLength(1);
    expect(errorLines[0].status).toBe(500); // gated on upstream status, not the problem status
  });

  it('does not emit an ERROR log for a 4xx BffError', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockRejectedValue(new BffError(404, 'NOT_FOUND', 'missing'));

    await withV1(handler)(makeRequest(), makeParams());

    expect(logLines(spy).filter((l) => l.severity === 'ERROR')).toHaveLength(0);
  });

  it('includes clamped client page/action in the access log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const req = new Request('http://localhost/test', {
      headers: { 'x-client-page': '/services', 'x-client-action': 'refresh' },
    });

    await withV1(handler)(req, makeParams());

    const infoLines = logLines(spy).filter((l) => l.severity === 'INFO');
    expect(infoLines).toHaveLength(1);
    expect(infoLines[0].clientPage).toBe('/services');
    expect(infoLines[0].clientAction).toBe('refresh');
  });

  it('omits client page/action from the access log when absent', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withV1(handler)(makeRequest(), makeParams());

    const [info] = logLines(spy).filter((l) => l.severity === 'INFO');
    expect('clientPage' in info).toBe(false);
    expect('clientAction' in info).toBe(false);
  });

  it('records id-collapsed pathTemplate/pageTemplate alongside the raw path/clientPage', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const req = new Request('http://localhost/integration/api/v1/target-sources/123/resources', {
      headers: { 'x-client-page': '/target-sources/456' },
    });

    await withV1(handler)(req, makeParams());

    const [info] = logLines(spy).filter((l) => l.severity === 'INFO');
    // Raw values are preserved verbatim…
    expect(info.path).toBe('/integration/api/v1/target-sources/123/resources');
    expect(info.clientPage).toBe('/target-sources/456');
    // …and the id-collapsed templates are added for aggregation.
    expect(info.pathTemplate).toBe('/integration/api/v1/target-sources/:id/resources');
    expect(info.pageTemplate).toBe('/target-sources/:id');
  });

  it('omits pageTemplate when clientPage is absent (pathTemplate always present)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));

    await withV1(handler)(makeRequest(), makeParams());

    const [info] = logLines(spy).filter((l) => l.severity === 'INFO');
    expect('pageTemplate' in info).toBe(false);
    expect(info.pathTemplate).toBe('/test');
  });
});
