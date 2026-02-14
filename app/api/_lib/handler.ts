import { NextResponse } from 'next/server';
import { getRequestId } from '@/app/api/_lib/request-id';
import { handleUnexpectedError, transformLegacyError } from '@/app/api/_lib/problem';

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
    try {
      const params = await paramsPromise;
      const response = await handler(request, { requestId, params });

      // Already a problem+json response (from problemResponse()) — just add headers
      if (isProblemResponse(response)) {
        return addV1Headers(response, requestId, options?.expectedDuration);
      }

      // Non-2xx from legacy client — transform to problem+json
      if (!response.ok) {
        const problem = await transformLegacyError(response, requestId);
        return addV1Headers(problem, requestId, options?.expectedDuration);
      }

      return addV1Headers(response, requestId, options?.expectedDuration);
    } catch (error) {
      return handleUnexpectedError(error, requestId);
    }
  };
}
