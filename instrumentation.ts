/**
 * Next.js runs this once when a server instance boots (LIN-60). It is the only
 * boot hook the standalone `node server.js` invokes, so the fail-fast env check
 * lives here — `next.config.ts` is baked at build time and not re-evaluated at
 * runtime in standalone mode.
 *
 * Guards:
 *   - nodejs runtime only (edge has a restricted `process.env`).
 *   - skip the production-build phase: `register()` should not run there, but if
 *     the platform ever calls it during `next build` (no runtime env present),
 *     requiring BFF_API_URL would break `docker build`.
 *
 * The check itself lives in `instrumentation-node.ts` and is reached by dynamic
 * import, so the edge build of this file never contains a Node API. See that
 * file for why the guard above is not enough on its own.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  await import('@/instrumentation-node');
}
