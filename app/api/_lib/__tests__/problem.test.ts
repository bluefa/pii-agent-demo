import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import {
  createProblem,
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

describe('transformBffError parity with transformLegacyError (ADR-011 I-4)', () => {
  const cases: Array<{ status: number; code: string; message: string }> = [
    { status: 401, code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    { status: 403, code: 'FORBIDDEN', message: '권한이 없습니다.' },
    { status: 404, code: 'NOT_FOUND', message: '리소스를 찾을 수 없습니다.' },
    { status: 400, code: 'VALIDATION_FAILED', message: '필수 필드가 누락되었습니다.' },
    { status: 409, code: 'CONFLICT_IN_PROGRESS', message: '진행 중입니다.' },
    { status: 500, code: 'INTERNAL_ERROR', message: '서버 오류' },
  ];

  for (const { status, code, message } of cases) {
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
});
