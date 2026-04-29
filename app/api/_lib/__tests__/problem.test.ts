import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';
import {
  createProblem,
  extractBffError,
  bffErrorFromBody,
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
      timestamp: expect.any(String),
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

  it('upstream timestamp를 문자열 그대로 보존한다', () => {
    const problem = createProblem(
      'INTERNAL_ERROR',
      'boom',
      'req-ts',
      undefined,
      '2026-04-29T02:27:09.123Z',
    );

    expect(problem.timestamp).toBe('2026-04-29T02:27:09.123Z');
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

describe('transformBffError parity with transformLegacyError (ADR-011 I-4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T02:27:09.123Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Status × code matrix — verifies KnownErrorCode mapping is identical.
  const statusCases: Array<{ status: number; code: string; message: string }> = [
    { status: 401, code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    { status: 403, code: 'FORBIDDEN', message: '권한이 없습니다.' },
    { status: 404, code: 'NOT_FOUND', message: '리소스를 찾을 수 없습니다.' },
    { status: 400, code: 'VALIDATION_FAILED', message: '필수 필드가 누락되었습니다.' },
    { status: 409, code: 'CONFLICT_IN_PROGRESS', message: '진행 중입니다.' },
    { status: 500, code: 'INTERNAL_ERROR', message: '서버 오류' },
  ];

  for (const { status, code, message } of statusCases) {
    it(`${status} ${code} produces a body byte-identical to transformLegacyError`, async () => {
      const requestId = 'req-parity';

      const fromBff = transformBffError(new BffError(status, code, message), requestId);
      const fromLegacy = await transformLegacyError(
        NextResponse.json({ error: code, message }, { status }),
        requestId,
      );

      expect(fromBff.status).toBe(fromLegacy.status);
      expect(fromBff.headers.get('content-type')).toBe(fromLegacy.headers.get('content-type'));
      await expect(fromBff.json()).resolves.toEqual(await fromLegacy.json());
    });
  }

  // Body-shape matrix — verifies extraction across nested / flat / unknown.
  const shapeCases = [
    { name: 'flat code', body: { error: 'NOT_FOUND', message: 'foo' }, status: 404 },
    { name: 'nested code', body: { error: { code: 'FORBIDDEN', message: '권한 없음' } }, status: 403 },
    { name: 'flat key', body: { code: 'VALIDATION_FAILED', message: 'bad input' }, status: 400 },
    {
      name: 'flat key with timestamp',
      body: {
        timestamp: '2026-04-29T02:27:09.123Z',
        code: 'INTERNAL_ERROR',
        message: 'server error',
      },
      status: 500,
    },
    { name: 'unknown code → status fallback', body: { error: 'XYZ', message: 'huh' }, status: 409 },
  ];

  for (const tc of shapeCases) {
    it(`${tc.name} (${tc.status}) — old vs new path produce identical body`, async () => {
      const legacyResp = NextResponse.json(tc.body, { status: tc.status });
      const oldOut = await transformLegacyError(legacyResp, 'req-x');
      const oldBody = await oldOut.json();

      const newOut = transformBffError(bffErrorFromBody(tc.status, tc.body), 'req-x');
      const newBody = await newOut.json();

      expect(newBody).toEqual(oldBody);
      expect(newOut.status).toBe(oldOut.status);
      expect(newOut.headers.get('content-type')).toBe(oldOut.headers.get('content-type'));
    });
  }
});
