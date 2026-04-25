import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import {
  createProblem,
  extractBffError,
  problemResponse,
  handleUnexpectedError,
  transformBffError,
  transformLegacyError,
} from '@/app/api/_lib/problem';
import { BffError } from '@/lib/bff/errors';

describe('createProblem', () => {
  it('UNAUTHORIZED 코드로 올바른 ProblemDetails를 반환한다', () => {
    const problem = createProblem('UNAUTHORIZED', 'msg', 'req-1');

    expect(problem).toEqual({
      type: 'https://pii-agent.dev/problems/UNAUTHORIZED',
      title: 'Unauthorized',
      status: 401,
      detail: 'msg',
      code: 'UNAUTHORIZED',
      retriable: false,
      requestId: 'req-1',
    });
  });

  it('RATE_LIMITED 코드는 retriable: true를 갖는다', () => {
    const problem = createProblem('RATE_LIMITED', 'too many', 'req-2');

    expect(problem.retriable).toBe(true);
    expect(problem.status).toBe(429);
  });
});

describe('problemResponse', () => {
  it('ProblemDetails에 맞는 status와 content-type을 반환한다', async () => {
    const problem = createProblem('UNAUTHORIZED', 'no auth', 'req-3');
    const response = problemResponse(problem);

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toBe('application/problem+json');

    const body = await response.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.requestId).toBe('req-3');
  });
});

describe('handleUnexpectedError', () => {
  it('500 상태와 INTERNAL_ERROR 코드를 반환한다', async () => {
    const response = handleUnexpectedError(new Error('boom'), 'req-4');

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.requestId).toBe('req-4');
  });
});

describe('extractBffError', () => {
  it('flat shape { error: "CODE", message } 를 추출한다', () => {
    expect(extractBffError({ error: 'NOT_FOUND', message: 'not found' }))
      .toEqual({ code: 'NOT_FOUND', message: 'not found' });
  });

  it('nested shape { error: { code, message } } 를 추출한다', () => {
    expect(extractBffError({ error: { code: 'FORBIDDEN', message: '권한 없음' } }))
      .toEqual({ code: 'FORBIDDEN', message: '권한 없음' });
  });

  it('flat shape { code, message } 를 추출한다', () => {
    expect(extractBffError({ code: 'INTERNAL_ERROR', message: '오류' }))
      .toEqual({ code: 'INTERNAL_ERROR', message: '오류' });
  });

  it('빈 body는 빈 code/message로 fallback', () => {
    expect(extractBffError({})).toEqual({ code: '', message: '' });
  });
});

describe('transformBffError parity with transformLegacyError', () => {
  // Both error paths must produce byte-identical ProblemDetails for the
  // same upstream error body, regardless of nested vs flat shape.
  const cases = [
    { name: 'flat code', body: { error: 'NOT_FOUND', message: 'foo' }, status: 404 },
    { name: 'nested code', body: { error: { code: 'FORBIDDEN', message: '권한 없음' } }, status: 403 },
    { name: 'flat key', body: { code: 'VALIDATION_FAILED', message: 'bad input' }, status: 400 },
    { name: 'unknown code → status fallback', body: { error: 'XYZ', message: 'huh' }, status: 409 },
  ];

  for (const tc of cases) {
    it(`${tc.name} (${tc.status}) — old vs new path produce identical body`, async () => {
      // Old path: NextResponse → transformLegacyError
      const legacyResp = NextResponse.json(tc.body, { status: tc.status });
      const oldOut = await transformLegacyError(legacyResp, 'req-x');
      const oldBody = await oldOut.json();

      // New path: BffError → transformBffError (same body extracted via shared helper)
      const { code, message } = extractBffError(tc.body);
      const bffErr = new BffError(tc.status, code || 'INTERNAL_ERROR', message || `HTTP ${tc.status}`);
      const newOut = transformBffError(bffErr, 'req-x');
      const newBody = await newOut.json();

      expect(newBody).toEqual(oldBody);
      expect(newOut.status).toBe(oldOut.status);
      expect(newOut.headers.get('content-type')).toBe(oldOut.headers.get('content-type'));
    });
  }
});
