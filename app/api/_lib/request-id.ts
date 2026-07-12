import { randomUUID } from 'crypto';

/** Client-generated UUIDs (LIN-61 correlation) — reject anything else. */
const REQUEST_ID_RE = /^[0-9a-fA-F-]{8,64}$/;

export function getRequestId(request: Request): string {
  const inbound = request.headers.get('x-request-id');
  if (inbound && REQUEST_ID_RE.test(inbound)) return inbound;
  return randomUUID();
}
