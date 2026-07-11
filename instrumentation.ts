import { assertRuntimeEnv } from '@/lib/env';

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
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    assertRuntimeEnv();
  } catch (err) {
    // Exit deterministically rather than throw: Next binds the HTTP listener
    // before the instrumentation hook rejects, so a throw leaves a broken
    // server *listening* (an unhandledRejection). A PII server must die loudly.
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
