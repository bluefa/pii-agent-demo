import { NextResponse } from 'next/server';
import { getRequestId } from '@/app/api/_lib/request-id';
import { handleUnexpectedError, transformBffError, transformLegacyError } from '@/app/api/_lib/problem';
import { errorStack, logAccess, logError } from '@/app/api/_lib/log';
import { clampHeaderValue } from '@/lib/observability-headers';
import { BffError } from '@/lib/bff/errors';

const PROBLEM_JSON = 'application/problem+json';

export interface V1HandlerContext {
  requestId: string;
  params: Record<string, string>;
}

interface V1Options {
  expectedDuration?: string;
}

type V1Handler = (
  request: Request,
  context: V1HandlerContext,
) => Promise<NextResponse>;

function isProblemResponse(response: NextResponse): boolean {
  return (response.headers.get('content-type') ?? '').includes(PROBLEM_JSON);
}

function addV1Headers(
  response: NextResponse,
  requestId: string,
  expectedDuration?: string,
): NextResponse {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  if (expectedDuration) {
    headers.set('x-expected-duration', expectedDuration);
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withV1(
  handler: V1Handler,
  options?: V1Options,
) {
  return async (
    request: Request,
    { params: paramsPromise }: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    const start = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;
    const clientPage = clampHeaderValue(request.headers.get('x-client-page'));
    const clientAction = clampHeaderValue(request.headers.get('x-client-action'));
    const access = (status: number): void =>
      logAccess({ method, path, status, durationMs: Date.now() - start, requestId, clientPage, clientAction });
    try {
      const params = await paramsPromise;
      const response = await handler(request, { requestId, params });

      // Non-2xx from legacy client — transform to ProblemDetails
      if (!response.ok && !isProblemResponse(response)) {
        const problem = await transformLegacyError(response, requestId);
        access(problem.status);
        return addV1Headers(problem, requestId, options?.expectedDuration);
      }

      access(response.status);
      return addV1Headers(response, requestId, options?.expectedDuration);
    } catch (error) {
      // BffError thrown from `bff.<domain>.<method>` (typed BFF client) —
      // map to the same ProblemDetails shape as legacy `transformLegacyError`.
      if (error instanceof BffError) {
        const problem = transformBffError(error, requestId);
        // Upstream 5xx is a real failure — surface it at ERROR severity too.
        // Gate on the upstream status, not the mapped problem status (a 5xx can
        // map to a non-5xx problem code and would otherwise be missed).
        if (error.status >= 500) {
          logError(errorStack(error), { context: 'bff-upstream', method, path, status: error.status, requestId });
        }
        access(problem.status);
        return addV1Headers(problem, requestId, options?.expectedDuration);
      }
      access(500);
      return handleUnexpectedError(error, requestId);
    }
  };
}
