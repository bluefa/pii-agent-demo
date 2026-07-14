/**
 * Server-side sanitization for the observability correlation headers. Both the
 * BFF forwarder (lib/bff/http.ts) and the access log (app/api/_lib/handler.ts)
 * run inbound header values through here so an untrusted client cannot inject
 * oversized or malformed values into upstream requests or the log stream.
 */
import { isValidRequestId } from '@/app/api/_lib/request-id';

const MAX_HEADER_LEN = 256;

/** Clamp a free-text header (page/action) to a bounded length, else drop it. */
export function clampHeaderValue(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > MAX_HEADER_LEN ? value.slice(0, MAX_HEADER_LEN) : value;
}

/** Keep an inbound x-request-id only when it matches the safe pattern. */
export function safeForwardRequestId(value: string | null | undefined): string | undefined {
  return isValidRequestId(value) ? value : undefined;
}
