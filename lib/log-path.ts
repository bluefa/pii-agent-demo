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
