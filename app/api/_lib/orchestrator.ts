import { NextResponse } from 'next/server';
import { getRequestId } from '@/app/api/_lib/request-id';
import { OrchestratorUnreachableError } from '@/lib/bff/errors';
import type { OrchestratorRawResponse } from '@/lib/pipeline/types';

/**
 * Route wrapper for the pipeline-orchestrator proxy (LIN-25).
 *
 * Unlike `withV1`, this does NOT rewrite non-2xx bodies. The pipeline BFF domain
 * returns `{ status, body }` verbatim (204 → body null); this wrapper resolves
 * the Next 16 async params, stamps `x-request-id`, and passes the upstream
 * status + snake_case body straight through as the browser response. Only an
 * unreachable upstream (`OrchestratorUnreachableError`) is translated — to 502
 * `{ code: 'ORCHESTRATOR_UNREACHABLE' }`. See docs/api/pipeline-orchestrator-bff.md.
 */
export interface OrchestratorHandlerContext {
  requestId: string;
  params: Record<string, string>;
}

type OrchestratorHandler = (
  request: Request,
  context: OrchestratorHandlerContext,
) => Promise<OrchestratorRawResponse>;

const withRequestId = (response: NextResponse, requestId: string): NextResponse => {
  response.headers.set('x-request-id', requestId);
  return response;
};

const passthrough = ({ status, body }: OrchestratorRawResponse): NextResponse => {
  if (status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(body, { status });
};

export function withOrchestratorProxy(handler: OrchestratorHandler) {
  return async (
    request: Request,
    { params }: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    try {
      const resolvedParams = await params;
      const raw = await handler(request, { requestId, params: resolvedParams });
      return withRequestId(passthrough(raw), requestId);
    } catch (error) {
      if (error instanceof OrchestratorUnreachableError) {
        return withRequestId(
          NextResponse.json(
            { code: 'ORCHESTRATOR_UNREACHABLE', message: error.message },
            { status: 502 },
          ),
          requestId,
        );
      }
      return withRequestId(
        NextResponse.json(
          {
            code: 'ORCHESTRATOR_PROXY_ERROR',
            message: error instanceof Error ? error.message : 'unexpected proxy error',
          },
          { status: 500 },
        ),
        requestId,
      );
    }
  };
}
