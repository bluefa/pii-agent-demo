/**
 * Strip query string and fragment from a URL or path before it reaches a log
 * or an error message. Query strings can carry PII (e.g. `users/search?q=name`),
 * so only the path portion is ever emitted. Absolute URLs are reduced to their
 * pathname (scheme/host dropped); relative paths pass through query-stripped.
 * Pure and client-safe — no Node or Web platform dependency.
 */
export function sanitizeLogPath(pathOrUrl: string): string {
  const withoutQuery = pathOrUrl.split(/[?#]/)[0];
  const schemeIndex = withoutQuery.indexOf('://');
  if (schemeIndex === -1) return withoutQuery;
  const afterScheme = withoutQuery.slice(schemeIndex + 3);
  const slashIndex = afterScheme.indexOf('/');
  return slashIndex === -1 ? '/' : afterScheme.slice(slashIndex);
}

/** Path segment that is purely numeric (e.g. a target-source id). */
const NUMERIC_SEGMENT = /^\d+$/;
/** Canonical UUID (any case) — kept as one segment since it holds no slash. */
const UUID_SEGMENT = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Long hex token (≥8 chars) — hashes, opaque ids. Below 8 chars is preserved. */
const HEX_SEGMENT = /^[0-9a-fA-F]{8,}$/;

/**
 * Collapse variable id-like path segments to `:id` so a per-request path can be
 * grouped into a stable template for aggregation. Numeric, UUID, and long-hex
 * (≥8 chars) segments become `:id`; every other segment is preserved verbatim.
 * Expects a query-free path (call sites feed already-sanitized values).
 *
 * @example normalizePathTemplate('/integration/target-sources/123') // '/integration/target-sources/:id'
 * @example normalizePathTemplate('/integration/services')           // '/integration/services'
 */
export function normalizePathTemplate(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (segment === '') return segment;
      if (NUMERIC_SEGMENT.test(segment) || UUID_SEGMENT.test(segment) || HEX_SEGMENT.test(segment)) {
        return ':id';
      }
      return segment;
    })
    .join('/');
}
