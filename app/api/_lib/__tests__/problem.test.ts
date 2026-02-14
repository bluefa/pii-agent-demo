import { describe, it, expect } from 'vitest';
import {
  createProblem,
  problemResponse,
  handleUnexpectedError,
} from '@/app/api/_lib/problem';

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
