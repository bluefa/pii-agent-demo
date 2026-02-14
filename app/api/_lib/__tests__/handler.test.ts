import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';

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
});
