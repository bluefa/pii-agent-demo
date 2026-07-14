/**
 * Browser error reporter (observability v3, Phase 3).
 *
 * Collects only client-only errors the server can't see (root layout errors,
 * boundary reports, unhandled rejections, window.onerror). API failures are
 * recorded at the source by the server (withV1) and are not re-sent here.
 *
 * POSTs with raw fetch only (never fetchJson) — fetchJson would push this report
 * back into the ring buffer, attach correlation headers, and, on failure, feed
 * its own rejection handler. All failures are swallowed.
 */

import { toInternalInfraApiPath } from '@/lib/infra-api';
import { getRecentApiCalls } from '@/lib/fetch-json';

export type ClientErrorType = 'global' | 'boundary' | 'rejection' | 'error-event';

export interface ClientErrorInput {
  type: ClientErrorType;
  message: string;
  stack?: string;
  digest?: string;
  componentStack?: string;
}

const ENDPOINT = toInternalInfraApiPath('/observability/client-errors');

// Throttle: suppress an identical message for 30s + cap 10/min (per-tab, in-memory).
const DEDUPE_MS = 30_000;
const MAX_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

const lastSentAt = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function shouldSend(message: string, now: number): boolean {
  const last = lastSentAt.get(message);
  if (last !== undefined && now - last < DEDUPE_MS) return false;

  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
    // Bound memory: drop dedupe entries older than the dedupe window on rotation.
    for (const [key, sentAt] of lastSentAt) {
      if (now - sentAt >= DEDUPE_MS) lastSentAt.delete(key);
    }
  }
  if (windowCount >= MAX_PER_MINUTE) return false;

  lastSentAt.set(message, now);
  windowCount += 1;
  return true;
}

/** Test-only: current dedupe map size, to assert pruning bounds growth. */
export function __dedupeSizeForTest(): number {
  return lastSentAt.size;
}

export function reportClientError(input: ClientErrorInput): void {
  try {
    const now = Date.now();
    if (!shouldSend(input.message, now)) return;

    const payload = {
      type: input.type,
      message: input.message,
      stack: input.stack,
      digest: input.digest,
      componentStack: input.componentStack,
      page: typeof location !== 'undefined' ? location.pathname : undefined,
      breadcrumbs: getRecentApiCalls(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // swallow — the reporter must never surface or re-throw.
    });
  } catch {
    // swallow — serialization or any other failure is non-fatal.
  }
}

let handlersInstalled = false;

/** Idempotent: wires window `error` + `unhandledrejection` once per tab. */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled || typeof window === 'undefined') return;
  handlersInstalled = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      type: 'error-event',
      message: event.message || 'Uncaught error',
      stack: event.error instanceof Error ? event.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      type: 'rejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
