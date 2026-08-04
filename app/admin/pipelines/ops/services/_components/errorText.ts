import { AppError } from '@/lib/errors';

/**
 * 모달에 띄울 실패 문구.
 *
 * 서버가 ProblemDetails 로 detail 을 주면 그대로 보여준다 — 왜 실패했는지는 서버만 안다
 * (EOS 409 의 "진행 중인 파이프라인 N건" 같은 것). 다만 fetchJson 은 detail 이 없을 때
 * `HTTP 500` 을 message 로 채우고 isUserFacing 은 그대로 true 라, 그 값을 믿고 찍으면
 * 운영자가 화면에서 "HTTP 500" 을 보게 된다. 그 fallback 만 걸러 우리 문구로 바꾼다.
 */
export const userErrorText = (err: unknown, fallback: string): string =>
  err instanceof AppError && err.isUserFacing && !/^HTTP \d+$/.test(err.message)
    ? err.message
    : fallback;
