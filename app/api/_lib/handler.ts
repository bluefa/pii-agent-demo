import { NextResponse } from 'next/server';
import { getRequestId } from '@/app/api/_lib/request-id';
import { handleUnexpectedError, transformLegacyError } from '@/app/api/_lib/problem';

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

      if (!response.ok) {
        return transformLegacyError(response, requestId);
      }

      return addV1Headers(response, requestId, options?.expectedDuration);
    } catch (error) {
      return handleUnexpectedError(error, requestId);
    }
  };
}
