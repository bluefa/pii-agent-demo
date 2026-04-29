import { NextResponse } from 'next/server';
import { BffError } from '@/lib/bff/errors';

// --- Error Code Catalog ---

export type KnownErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'APPROVED_INTEGRATION_NOT_FOUND'
  | 'TARGET_SOURCE_NOT_FOUND'
  | 'SERVICE_NOT_FOUND'
  | 'CONFIRMED_INTEGRATION_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_PARAMETER'
  | 'INVALID_PROVIDER'
  | 'CONFLICT_IN_PROGRESS'
  | 'CONFLICT_APPLYING_IN_PROGRESS'
  | 'CONFLICT_REQUEST_PENDING'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'GUIDE_NOT_FOUND'
  | 'GUIDE_CONTENT_INVALID';

interface ErrorMeta {
  status: number;
  title: string;
  retriable: boolean;
}

const ERROR_CATALOG: Record<KnownErrorCode, ErrorMeta> = {
  UNAUTHORIZED: { status: 401, title: 'Unauthorized', retriable: false },
  FORBIDDEN: { status: 403, title: 'Forbidden', retriable: false },
  APPROVED_INTEGRATION_NOT_FOUND: { status: 404, title: 'Approved Integration Not Found', retriable: false },
  TARGET_SOURCE_NOT_FOUND: { status: 404, title: 'Target Source Not Found', retriable: false },
  SERVICE_NOT_FOUND: { status: 404, title: 'Service Not Found', retriable: false },
  CONFIRMED_INTEGRATION_NOT_FOUND: { status: 404, title: 'Confirmed Integration Not Found', retriable: false },
  VALIDATION_FAILED: { status: 400, title: 'Validation Failed', retriable: false },
  INVALID_PARAMETER: { status: 400, title: 'Invalid Parameter', retriable: false },
  INVALID_PROVIDER: { status: 400, title: 'Invalid Provider', retriable: false },
  CONFLICT_IN_PROGRESS: { status: 409, title: 'Conflict', retriable: true },
  CONFLICT_APPLYING_IN_PROGRESS: { status: 409, title: 'Applying In Progress', retriable: true },
  CONFLICT_REQUEST_PENDING: { status: 409, title: 'Request Pending', retriable: false },
  RATE_LIMITED: { status: 429, title: 'Rate Limited', retriable: true },
  INTERNAL_ERROR: { status: 500, title: 'Internal Server Error', retriable: false },
  GUIDE_NOT_FOUND: { status: 404, title: 'Guide Not Found', retriable: false },
  GUIDE_CONTENT_INVALID: { status: 400, title: 'Guide Content Invalid', retriable: false },
};

// --- ProblemDetails (RFC 9457) ---

export interface ProblemDetails {
  timestamp: string;
  type: string;
  title: string;
  status: number;
  detail: string;
  code: KnownErrorCode;
  retriable: boolean;
  retryAfterMs?: number;
  requestId: string;
}

export function createProblem(
  code: KnownErrorCode,
  detail: string,
  requestId: string,
  retryAfterMs?: number,
  timestamp = new Date().toISOString(),
): ProblemDetails {
  const meta = ERROR_CATALOG[code];
  return {
    timestamp,
    type: `https://pii-agent.dev/problems/${code}`,
    title: meta.title,
    status: meta.status,
    detail,
    code,
    retriable: meta.retriable,
    ...(retryAfterMs !== undefined && { retryAfterMs }),
    requestId,
  };
}

export function problemResponse(problem: ProblemDetails): NextResponse {
  return NextResponse.json(problem, {
    status: problem.status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

// --- Legacy Error Conversion ---

/** Upstream BFF error body — nested `{error: {code, message}}` or flat `{error, message}`. */
export interface BffErrorBody {
  error?: string | { code?: string; message?: string };
  code?: string;
  message?: string;
  timestamp?: unknown;
}

export function extractBffError(body: BffErrorBody): { code: string; message: string } {
  // nested: { error: { code, message } }
  if (body.error && typeof body.error === 'object') {
    return {
      code: body.error.code ?? '',
      message: body.error.message ?? '',
    };
  }
  // flat legacy: { error: "CODE", message: "..." }
  if (typeof body.error === 'string') {
    return { code: body.error, message: body.message ?? '' };
  }
  // flat: { code: "...", message: "..." }
  return { code: body.code ?? '', message: body.message ?? '' };
}

function extractBffTimestamp(body: unknown): string | undefined {
  return typeof body === 'object'
    && body !== null
    && 'timestamp' in body
    && typeof body.timestamp === 'string'
    ? body.timestamp
    : undefined;
}

const LEGACY_CODE_MAP: Record<string, KnownErrorCode> = {
  // 정규화된 코드 (KnownErrorCode와 동일)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TARGET_SOURCE_NOT_FOUND: 'TARGET_SOURCE_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONFLICT_IN_PROGRESS: 'CONFLICT_IN_PROGRESS',
  CONFLICT_APPLYING_IN_PROGRESS: 'CONFLICT_APPLYING_IN_PROGRESS',
  CONFLICT_REQUEST_PENDING: 'CONFLICT_REQUEST_PENDING',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // 레거시 코드 (BFF 마이그레이션 전 호환)
  NOT_FOUND: 'TARGET_SOURCE_NOT_FOUND',
  CONFIRMED_INTEGRATION_NOT_FOUND: 'CONFIRMED_INTEGRATION_NOT_FOUND',
  INVALID_PROVIDER: 'INVALID_PROVIDER',
  INVALID_REQUEST: 'VALIDATION_FAILED',
  ALREADY_SET: 'CONFLICT_IN_PROGRESS',
  ALREADY_EXISTS: 'CONFLICT_IN_PROGRESS',
  PermissionDenied: 'FORBIDDEN',
  AccessDenied: 'FORBIDDEN',
  TargetSourceNotFound: 'TARGET_SOURCE_NOT_FOUND',
  BadRequest: 'VALIDATION_FAILED',
  ERR_AUTH_001: 'UNAUTHORIZED',
  ERR_UNAUTHORIZED_ACCESS: 'UNAUTHORIZED',
};

function mapLegacyCode(legacyCode: string, status: number): KnownErrorCode {
  const mapped = LEGACY_CODE_MAP[legacyCode];
  if (mapped) return mapped;

  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'TARGET_SOURCE_NOT_FOUND';
  if (status === 409) return 'CONFLICT_IN_PROGRESS';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

export async function transformLegacyError(
  response: NextResponse,
  requestId: string,
): Promise<NextResponse> {
  try {
    const raw = await response.json();
    const { code: errorCode, message } = extractBffError(raw as BffErrorBody);
    const code = mapLegacyCode(errorCode, response.status);
    return problemResponse(createProblem(code, message, requestId, undefined, extractBffTimestamp(raw)));
  } catch {
    return problemResponse(createProblem(
      'INTERNAL_ERROR',
      '서버에서 오류가 발생했습니다.',
      requestId,
    ));
  }
}

/**
 * Convert a thrown `BffError` from a typed BFF call into a ProblemDetails
 * response. Output is byte-identical to `transformLegacyError` applied to
 * `NextResponse.json({ error: code, message }, { status })`.
 */
export function transformBffError(
  error: BffError,
  requestId: string,
): NextResponse {
  const code = mapLegacyCode(error.code, error.status);
  return problemResponse(createProblem(code, error.message, requestId, undefined, error.timestamp));
}

/**
 * Construct a BffError from an upstream error body, applying the same
 * shape extraction (nested `{error: {code, message}}` or flat) and
 * fallback codes used by `transformLegacyError`. Single source of truth
 * for both `httpBff` and `mockBff` adapters.
 */
export function bffErrorFromBody(status: number, body: unknown): BffError {
  const { code, message } = extractBffError(body as BffErrorBody);
  return new BffError(
    status,
    code || 'INTERNAL_ERROR',
    message || `HTTP ${status}`,
    extractBffTimestamp(body),
  );
}

// --- Uncaught Error Handler ---

export function handleUnexpectedError(
  error: unknown,
  requestId: string,
): NextResponse {
  console.error('[v1] Unexpected error:', error);
  return problemResponse(createProblem(
    'INTERNAL_ERROR',
    '서버에서 예기치 않은 오류가 발생했습니다.',
    requestId,
  ));
}
