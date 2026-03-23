import { snakeCaseKeys } from '@/lib/object-case';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

const hasJsonBody = (contentType: string | null): boolean =>
  contentType?.includes('application/json') === true || contentType?.includes('+json') === true;

const buildTargetUrl = (requestUrl: URL): URL => {
  const targetUrl = new URL(requestUrl.toString());
  targetUrl.pathname = requestUrl.pathname.replace('/api/infra/v1', '/api/v1');
  return targetUrl;
};

const forward = async (request: Request): Promise<Response> => {
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();

  const proxiedResponse = await fetch(buildTargetUrl(new URL(request.url)), {
    method: request.method,
    headers: request.headers,
    body,
  });

  if (!hasJsonBody(proxiedResponse.headers.get('content-type'))) {
    return new Response(proxiedResponse.body, {
      status: proxiedResponse.status,
      headers: proxiedResponse.headers,
    });
  }

  if (proxiedResponse.status === 204) {
    return new Response(null, {
      status: proxiedResponse.status,
      headers: proxiedResponse.headers,
    });
  }

  const headers = new Headers(proxiedResponse.headers);
  headers.set('content-type', JSON_CONTENT_TYPE);
  headers.delete('content-length');

  const json = await proxiedResponse.json();

  return new Response(JSON.stringify(snakeCaseKeys(json)), {
    status: proxiedResponse.status,
    headers,
  });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
export const OPTIONS = forward;
