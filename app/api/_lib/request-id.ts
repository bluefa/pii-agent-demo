import { randomUUID } from 'crypto';

/** Client-generated UUIDs (LIN-61 correlation) — reject anything else. */
const REQUEST_ID_RE = /^[0-9a-fA-F-]{8,64}$/;

/** True when `value` is a syntactically safe correlation id (hex + dashes). */
export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === 'string' && REQUEST_ID_RE.test(value);
}

export function getRequestId(request: Request): string {
  const inbound = request.headers.get('x-request-id');
  if (isValidRequestId(inbound)) return inbound;
  return randomUUID();
}
