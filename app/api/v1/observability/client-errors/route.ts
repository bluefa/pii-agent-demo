/**
 * Browser error ingest (observability v3, Phase 3).
 *
 * Deliberately NOT wrapped in `withV1`: this endpoint receives untrusted
 * client payloads and must stay isolated from BFF error normalization. Every
 * field is rebuilt from a strict allowlist — nothing outside it is ever logged
 * — and an accepted report becomes one structured stdout log line answering
 * 204. All rejections respond with an empty body — never echo input back.
 */
import { NextResponse } from 'next/server';
import { logAccess, logError } from '@/app/api/_lib/log';
import { getRequestId, isValidRequestId } from '@/app/api/_lib/request-id';
import { sanitizeLogPath } from '@/lib/log-path';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_FIELD_CHARS = 8 * 1024;
const MAX_PAGE_CHARS = 256;
const MAX_DIGEST_CHARS = 64;
const MAX_BREADCRUMBS = 10;
const MAX_METHOD_CHARS = 8;
const MAX_PATH_CHARS = 256;
const MAX_ACCEPTED_PER_MINUTE = 60;
const WINDOW_MS = 60_000;
const ROUTE_PATH = '/observability/client-errors';

const KNOWN_TYPES = new Set(['global', 'boundary', 'rejection', 'error-event']);

// Per-instance fixed-window rate cap. Beyond the cap, drop silently (204).
let windowStart = 0;
let acceptedInWindow = 0;
let capLoggedThisWindow = false;

function clampString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

interface SafeBreadcrumb {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestId?: string;
}

/** Rebuild breadcrumbs from an allowlist; drop malformed or nested entries. */
function sanitizeBreadcrumbs(value: unknown): SafeBreadcrumb[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: SafeBreadcrumb[] = [];
  for (const item of value.slice(0, MAX_BREADCRUMBS)) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    const method = clampString(entry.method, MAX_METHOD_CHARS);
    const path = typeof entry.path === 'string'
      ? sanitizeLogPath(entry.path).slice(0, MAX_PATH_CHARS)
      : undefined;
    const { status, durationMs } = entry;
    if (method === undefined || path === undefined) continue;
    if (typeof status !== 'number' || typeof durationMs !== 'number') continue;
    const requestId = typeof entry.requestId === 'string' && isValidRequestId(entry.requestId)
      ? entry.requestId
      : undefined;
    out.push({ method, path, status, durationMs, ...(requestId ? { requestId } : {}) });
  }
  return out.length > 0 ? out : undefined;
}

export async function POST(request: Request): Promise<NextResponse> {
  const start = Date.now();
  const requestId = getRequestId(request);

  // Reject before buffering when the client declares an oversize body.
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  // ponytail: this buffers the body before the byte check; the deployment-level
  // request-body limit (ingress/proxy) is the outer safeguard against a client
  // that omits/understates Content-Length. Full streaming enforcement isn't
  // practical in a Next route handler.
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
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

  const message = clampString(record.message, MAX_FIELD_CHARS) ?? '';
  const stack = clampString(record.stack, MAX_FIELD_CHARS);
  const type = typeof record.type === 'string' && KNOWN_TYPES.has(record.type) ? record.type : undefined;

  logError(stack ? `${message}\n${stack}` : message, {
    source: 'browser',
    page: typeof record.page === 'string' ? clampString(sanitizeLogPath(record.page), MAX_PAGE_CHARS) : undefined,
    type,
    digest: clampString(record.digest, MAX_DIGEST_CHARS),
    breadcrumbs: sanitizeBreadcrumbs(record.breadcrumbs),
    requestId,
  });

  return new NextResponse(null, { status: 204 });
}
