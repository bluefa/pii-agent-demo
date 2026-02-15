import { NextResponse } from 'next/server';

// --- Error Code Catalog ---

export type KnownErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TARGET_SOURCE_NOT_FOUND'
  | 'SERVICE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'INVALID_PARAMETER'
  | 'INVALID_PROVIDER'
  | 'CONFLICT_IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

interface ErrorMeta {
  status: number;
  title: string;
  retriable: boolean;
}

const ERROR_CATALOG: Record<KnownErrorCode, ErrorMeta> = {
  UNAUTHORIZED: { status: 401, title: 'Unauthorized', retriable: false },
  FORBIDDEN: { status: 403, title: 'Forbidden', retriable: false },
  TARGET_SOURCE_NOT_FOUND: { status: 404, title: 'Target Source Not Found', retriable: false },
  SERVICE_NOT_FOUND: { status: 404, title: 'Service Not Found', retriable: false },
  VALIDATION_FAILED: { status: 400, title: 'Validation Failed', retriable: false },
  INVALID_PARAMETER: { status: 400, title: 'Invalid Parameter', retriable: false },
  INVALID_PROVIDER: { status: 400, title: 'Invalid Provider', retriable: false },
  CONFLICT_IN_PROGRESS: { status: 409, title: 'Conflict', retriable: true },
  RATE_LIMITED: { status: 429, title: 'Rate Limited', retriable: true },
  INTERNAL_ERROR: { status: 500, title: 'Internal Server Error', retriable: false },
};

// --- ProblemDetails (RFC 9457) ---

export interface ProblemDetails {
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
): ProblemDetails {
  const meta = ERROR_CATALOG[code];
  return {
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

export type SwaggerErrorFormat = 'nested' | 'flat';

export function problemResponse(problem: ProblemDetails): NextResponse {
  return NextResponse.json(problem, {
    status: problem.status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

/** Swagger ErrorResponse — nested: {error:{code,message}}, flat: {code,message} */
export function swaggerErrorResponse(
  problem: ProblemDetails,
  format: SwaggerErrorFormat = 'nested',
): NextResponse {
  const body = format === 'nested'
    ? { error: { code: problem.code, message: problem.detail } }
    : { code: problem.code, message: problem.detail };
  return NextResponse.json(body, { status: problem.status });
}

// --- Legacy Error Conversion ---

export interface LegacyErrorBody {
  error: string;
  message: string;
}

const LEGACY_CODE_MAP: Record<string, KnownErrorCode> = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'TARGET_SOURCE_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_PROVIDER: 'INVALID_PROVIDER',
  INVALID_REQUEST: 'VALIDATION_FAILED',
  ALREADY_SET: 'CONFLICT_IN_PROGRESS',
  ALREADY_EXISTS: 'CONFLICT_IN_PROGRESS',
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
  errorFormat?: SwaggerErrorFormat,
): Promise<NextResponse> {
  try {
    const body = (await response.json()) as LegacyErrorBody;
    const code = mapLegacyCode(body.error, response.status);
    const problem = createProblem(code, body.message, requestId);
    return errorFormat
      ? swaggerErrorResponse(problem, errorFormat)
      : problemResponse(problem);
  } catch {
    const problem = createProblem(
      'INTERNAL_ERROR',
      '서버에서 오류가 발생했습니다.',
      requestId,
    );
    return errorFormat
      ? swaggerErrorResponse(problem, errorFormat)
      : problemResponse(problem);
  }
}

// --- Uncaught Error Handler ---

export function handleUnexpectedError(
  error: unknown,
  requestId: string,
  errorFormat?: SwaggerErrorFormat,
): NextResponse {
  console.error('[v1] Unexpected error:', error);
  const problem = createProblem(
    'INTERNAL_ERROR',
    '서버에서 예기치 않은 오류가 발생했습니다.',
    requestId,
  );
  return errorFormat
    ? swaggerErrorResponse(problem, errorFormat)
    : problemResponse(problem);
}
