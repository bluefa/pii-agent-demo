/**
 * CSR용 단일 fetch 래퍼.
 *
 * 모든 비정상 응답을 AppError로 정규화한다.
 * 컴포넌트/훅에서 res.ok 체크, 문자열 throw 금지 — 이 함수를 통해서만 호출.
 *
 * @see lib/errors.ts           — AppError 정의
 * @see docs/swagger/ERROR_HANDLING_DESIGN.md — 설계 문서
 */

import { AppError, isKnownErrorCode } from '@/lib/errors';
import type { AppErrorCode } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchJsonOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** 요청 타임아웃(ms). 기본 30초 */
  timeout?: number;
}

/** 서버 ProblemDetails 응답 형태 (v1 Route 전용) */
interface ProblemBody {
  code?: string;
  title?: string;
  detail?: string;
  retriable?: boolean;
  retryAfterMs?: number;
  requestId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** status code → fallback AppErrorCode (응답 body에 code가 없을 때만 사용) */
function statusToCode(status: number): AppErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

/** 응답 body에서 AppError를 생성 */
async function parseErrorResponse(res: Response): Promise<AppError> {
  const requestId = res.headers.get('x-request-id') ?? undefined;

  let body: ProblemBody = {};
  try {
    body = await res.json();
  } catch {
    return new AppError({
      status: res.status,
      code: statusToCode(res.status),
      message: `HTTP ${res.status}`,
      retriable: res.status === 429 || res.status >= 500,
      requestId,
    });
  }

  // 서버 code 검증 — 미정의 코드는 경고 후 fallback
  // 서버 code 검증 — 미정의 코드는 경고 후 fallback
  if (body.code && !isKnownErrorCode(body.code)) {
    console.warn(`[fetchJson] Unknown error code: "${body.code}" (status: ${res.status})`);
  }
  const code = body.code && isKnownErrorCode(body.code) ? body.code : undefined;

  const message = body.detail ?? body.title ?? `HTTP ${res.status}`;

  // retriable: 서버 값 우선, 없으면 status 기반 fallback
  const retriable = body.retriable ?? (res.status === 429 || res.status >= 500);

  // Retry-After 헤더 파싱 (서버 retryAfterMs 우선)
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfterMs = body.retryAfterMs
    ?? (retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined);

  return new AppError({
    status: res.status,
    code: code ?? statusToCode(res.status),
    message,
    retriable,
    retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    requestId: body.requestId ?? requestId,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * 타입 안전한 JSON fetch 래퍼.
 *
 * - 2xx → `T` 리턴 (204 No Content → `undefined as T`)
 * - 그 외 → `AppError` throw
 * - 네트워크/타임아웃/중단 → `AppError` throw (code: NETWORK/TIMEOUT/ABORTED)
 *
 * @example
 * ```ts
 * // GET
 * const project = await fetchJson<Project>('/api/projects/123');
 *
 * // POST
 * const result = await fetchJson<ScanJob>('/api/v1/scan', {
 *   method: 'POST',
 *   body: { targetSourceId: 1 },
 * });
 * ```
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { body, timeout = DEFAULT_TIMEOUT_MS, ...init } = options;

  // AbortController: 타임아웃 + 외부 signal 병합
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('TIMEOUT'), timeout);

  // 외부 signal이 있으면 연결
  if (init.signal) {
    init.signal.addEventListener('abort', () => controller.abort('ABORTED'), { once: true });
  }

  // Headers 병합: Headers 인스턴스/튜플 배열도 안전하게 처리
  const headers = new Headers(init.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.ok) {
      // 204 No Content
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    throw await parseErrorResponse(res);
  } catch (err) {
    if (err instanceof AppError) throw err;

    // AbortError (타임아웃 or 사용자 취소)
    if (err instanceof DOMException && err.name === 'AbortError') {
      const reason = controller.signal.reason;
      const isTimeout = reason === 'TIMEOUT';
      throw new AppError({
        status: 0,
        code: isTimeout ? 'TIMEOUT' : 'ABORTED',
        message: isTimeout ? '요청 시간이 초과되었습니다.' : '요청이 취소되었습니다.',
        retriable: isTimeout,
      });
    }

    // TypeError: 네트워크 에러 (DNS 실패, CORS, 오프라인 등)
    if (err instanceof TypeError) {
      throw new AppError({
        status: 0,
        code: 'NETWORK',
        message: '네트워크 연결을 확인해주세요.',
        retriable: true,
      });
    }

    // 그 외
    throw new AppError({
      status: 0,
      code: 'UNKNOWN',
      message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      retriable: false,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
