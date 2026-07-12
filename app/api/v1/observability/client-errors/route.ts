/**
 * Browser error ingest (observability v3, Phase 3).
 *
 * Deliberately NOT wrapped in `withV1`: this endpoint receives untrusted
 * client payloads and must stay isolated from BFF error normalization. It
 * turns an accepted report into one structured stdout log line and answers
 * 204. All rejections respond with an empty body — never echo input back.
 */
import { NextResponse } from 'next/server';
import { logAccess, logError } from '@/app/api/_lib/log';
import { getRequestId } from '@/app/api/_lib/request-id';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_CHARS = 8 * 1024;
const MAX_ACCEPTED_PER_MINUTE = 60;
const WINDOW_MS = 60_000;
const ROUTE_PATH = '/observability/client-errors';

// Per-instance fixed-window rate cap. Beyond the cap, drop silently (204).
let windowStart = 0;
let acceptedInWindow = 0;
let capLoggedThisWindow = false;

function clampField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > MAX_FIELD_CHARS ? value.slice(0, MAX_FIELD_CHARS) : value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  const start = Date.now();
  const requestId = getRequestId(request);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return new NextResponse(null, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (typeof record.message !== 'string' || record.message.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    acceptedInWindow = 0;
    capLoggedThisWindow = false;
  }
  if (acceptedInWindow >= MAX_ACCEPTED_PER_MINUTE) {
    if (!capLoggedThisWindow) {
      capLoggedThisWindow = true;
      logAccess({ method: 'POST', path: ROUTE_PATH, status: 204, durationMs: Date.now() - start, requestId });
    }
    return new NextResponse(null, { status: 204 });
  }
  acceptedInWindow += 1;

  const message = clampField(record.message) ?? '';
  const stack = clampField(record.stack);

  logError(stack ? `${message}\n${stack}` : message, {
    source: 'browser',
    page: optionalString(record.page),
    type: optionalString(record.type),
    requestId,
  });

  return new NextResponse(null, { status: 204 });
}
