/**
 * 클라이언트 사이드 에러 정규화 클래스.
 *
 * 서버의 ProblemDetails(RFC 9457)와 1:1 대응하되,
 * 네트워크/타임아웃 등 HTTP 응답이 없는 경우도 동일 형태로 표현한다.
 *
 * @see app/api/_lib/problem.ts  — 서버 측 ProblemDetails 정의
 * @see docs/swagger/ERROR_HANDLING_DESIGN.md  — 설계 문서
 */

/** HTTP 표준 에러 코드 + 클라이언트 전용 코드 */
export type AppErrorCode =
  // HTTP 표준 에러 (status code 기반)
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  // 클라이언트 전용 codes
  | 'NETWORK'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/** fetchJson이 인식하는 에러 코드 allowlist */
export const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);

export function isKnownErrorCode(s: string): s is AppErrorCode {
  return KNOWN_ERROR_CODES.has(s);
}

export interface AppErrorInit {
  status: number;
  code: AppErrorCode;
  message: string;
  retriable: boolean;
  retryAfterMs?: number;
  requestId?: string;
}

export class AppError extends Error {
  /** HTTP status code (네트워크 에러 등 응답 없으면 0) */
  readonly status: number;
  /** 구조화된 에러 코드 — Layer 2에서 분기 기준 */
  readonly code: AppErrorCode;
  /** 재시도 가능 여부 */
  readonly retriable: boolean;
  /** 서버가 제공한 재시도 대기 시간(ms) */
  readonly retryAfterMs?: number;
  /** 요청 추적용 ID */
  readonly requestId?: string;

  constructor(init: AppErrorInit) {
    super(init.message);
    this.name = 'AppError';
    this.status = init.status;
    this.code = init.code;
    this.retriable = init.retriable;
    this.retryAfterMs = init.retryAfterMs;
    this.requestId = init.requestId;
  }

  /** 사용자에게 보여줘도 안전한 메시지인지 (서버가 준 detail) */
  get isUserFacing(): boolean {
    return this.status > 0 && this.code !== 'UNKNOWN';
  }
}
