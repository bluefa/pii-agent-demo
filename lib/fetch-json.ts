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
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, parseLocaleCookie, type Locale } from '@/lib/locale';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchJsonOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** 요청 타임아웃(ms). 기본 30초 */
  timeout?: number;
}

/** ProblemDetails (RFC 9457) 에러 응답 형태 */
interface ErrorBody {
  timestamp?: string;
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

/**
 * The sentence a transport failure carries, per language.
 *
 * These four are UI copy, not wire text: this module authors them for failures that never
 * reached a server, so nothing upstream has an opinion about their wording. The word is a
 * default rendering of the `code` stamped beside it, which is why the table is keyed the
 * same way the throw sites are.
 *
 * `network` and `unknown` are verbatim from `app/components/ui/confirm-failures.ts`, which
 * words the same two codes: one failure must not be told two different ways by a toast and
 * by the approval modal.
 *
 * `timeout` deliberately differs from that table's TIMEOUT row, and the two English strings
 * for one code are intentional. `FAILURES_EN.TIMEOUT` renders in a dialog that owns a retry
 * button, so it can end with "try again in a moment"; these messages ride a toast, which
 * offers no such affordance, and an English string that instructs where the Korean beside it
 * only states is a copy defect rather than a consistency win. The Korean pair already splits
 * the same way — a sentence may only ask for the action its own surface can perform.
 */
const ko = {
  timeout: '요청 시간이 초과되었습니다.',
  aborted: '요청이 취소되었습니다.',
  network: '네트워크 연결을 확인해주세요.',
  unknown: '알 수 없는 오류가 발생했습니다.',
};

const en: typeof ko = {
  timeout: 'The request timed out.',
  aborted: 'The request was cancelled.',
  network: 'Check your network connection.',
  unknown: 'Something went wrong.',
};

const TRANSPORT_MESSAGES: Record<Locale, typeof ko> = { ko, en };

const LOCALE_COOKIE_RE = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]*)`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The reader's language, from the cookie that seeds `LocaleProvider`.
 *
 * A plain module has no provider to ask and must not take a hook, so it reads the one
 * source the provider itself is seeded from rather than growing a second answer. On the
 * server, and in any test that never wrote the cookie, this is Korean exactly as before.
 */
const readerLocale = (): Locale => {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  return parseLocaleCookie(LOCALE_COOKIE_RE.exec(document.cookie)?.[1]);
};

/** Read per throw rather than per call: a transport failure is the rare path. */
const transportMessage = (key: keyof typeof ko): string => TRANSPORT_MESSAGES[readerLocale()][key];

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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** 응답 body에서 AppError를 생성 */
async function parseErrorResponse(res: Response): Promise<AppError> {
  const requestId = res.headers.get('x-request-id') ?? undefined;

  let body: ErrorBody = {};
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

  // code 검증: 미정의 코드는 경고 후 status fallback
  const rawCode = body.code;
  if (rawCode && !isKnownErrorCode(rawCode)) {
    console.warn(`[fetchJson] Unknown error code: "${rawCode}" (status: ${res.status})`);
  }
  const code = rawCode && isKnownErrorCode(rawCode) ? rawCode : undefined;

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
    timestamp: optionalString(body.timestamp),
    retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    requestId: body.requestId ?? requestId,
    // 위 allowlist 를 통과하지 못한 코드도 여기에는 그대로 실린다 — `code` 는 분기용으로
    // 좁혀 두고, 서버가 말한 문자열은 잃지 않는다.
    rawCode: optionalString(body.code),
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
 * const result = await fetchJson<ScanJob>('/api/infra/v1/scan', {
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

  // 외부 signal이 있으면 연결 (이미 aborted 상태면 즉시 반영)
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort('ABORTED');
    } else {
      init.signal.addEventListener('abort', () => controller.abort('ABORTED'), { once: true });
    }
  }

  // FormData 는 fetch 가 boundary 를 붙여 Content-Type 을 직접 만든다 — 여기서
  // 미리 정하면 boundary 가 빠져 서버의 multipart 파싱이 깨진다. 그래서 헤더도
  // 직렬화도 건너뛴다. 파일 업로드가 이 래퍼를 못 쓰고 raw fetch 로 빠지면
  // 타임아웃도 네트워크 에러 정규화도 같이 잃는다.
  const isFormData = body instanceof FormData;
  const headers = new Headers(init.headers);
  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    console.log('HTTP 요청:', url, init);
    const res = await fetch(url, {
      ...init,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
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

    // Abort 감지: signal.aborted 가 우선 — Chrome은 abort(reason) 의 reason 이
    // 문자열이면 fetch 가 DOMException 이 아니라 그 문자열을 그대로 reject 하므로
    // `err instanceof DOMException` 체크만으로는 abort 를 놓친다.
    // 호출자(ignoreAborted, error.code === 'ABORTED' 가드)가 이 에러를 무시하도록
    // 설계됐으므로 정상 흐름이며, 사용자에게 노출되지 않는다.
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      const isTimeout = reason === 'TIMEOUT';
      if (process.env.NODE_ENV !== 'production' && !isTimeout) {
        // Dev only: race를 진단하기 위한 신호. 사용자에게는 안 보이므로 production에서는 제거.
        console.debug('[fetchJson] aborted (caller superseded):', url);
      }
      throw new AppError({
        status: 0,
        code: isTimeout ? 'TIMEOUT' : 'ABORTED',
        message: transportMessage(isTimeout ? 'timeout' : 'aborted'),
        retriable: isTimeout,
      });
    }

    // TypeError: 네트워크 에러 (DNS 실패, CORS, 오프라인 등)
    if (err instanceof TypeError) {
      throw new AppError({
        status: 0,
        code: 'NETWORK',
        message: transportMessage('network'),
        retriable: true,
      });
    }

    throw new AppError({
      status: 0,
      code: 'UNKNOWN',
      // Only the fallback half — `err.message` is an arbitrary caught error, not our copy.
      message: err instanceof Error ? err.message : transportMessage('unknown'),
      retriable: false,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
