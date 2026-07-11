import { z } from 'zod';

/**
 * Environment contract. Two gates share this module (LIN-60):
 *   - `assertBuildEnv()`  runs in `next.config.ts` (build + config load).
 *   - `assertRuntimeEnv()` runs in `instrumentation.ts` `register()` at server
 *     boot — the only hook the standalone `node server.js` actually invokes,
 *     so runtime-only checks (BFF_API_URL) must live there, not in next.config.
 *
 * `BFF_API_URL` is deliberately NOT required at build time: `docker build`
 * runs `next build` with no runtime env (`.env*` is excluded from the image),
 * and prerender must still succeed. Its presence is enforced at boot instead.
 *
 * `USE_MOCK_DATA` has a single meaning everywhere: only the literal `'true'` is
 * mock; anything else — including unset — is real. Call `isMock()` rather than
 * re-deriving the flag so the two interpretations can never drift again.
 */

/**
 * Single source of truth for mock mode. Unset ⇒ real (safe default). Evaluated
 * at call time: prod env is fixed at boot, and tests stub it per case without
 * fighting module caching.
 */
export const isMock = (): boolean => process.env.USE_MOCK_DATA === 'true';

const envSchema = z.object({
  USE_MOCK_DATA: z.string().optional(),
  BFF_API_URL: z.string().url().optional(),
});

function parse(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`[env] Invalid environment variables:\n${detail}`);
  }
  return result.data;
}

/**
 * prod + mock is a fatal combination for a PII tool: a production server would
 * serve seed data. No override flag — running mock in production is never
 * intended; add one only if a concrete need appears.
 */
const isProdMock = (): boolean => process.env.NODE_ENV === 'production' && isMock();

const PROD_MOCK_MESSAGE =
  '[env] USE_MOCK_DATA=true with NODE_ENV=production: a PII tool must never serve ' +
  'seed data. Unset USE_MOCK_DATA for production deployments.';

/**
 * Build/config-load gate (next.config.ts). Validates shape and *warns* on
 * prod+mock — it does NOT throw. `next build` always runs with
 * NODE_ENV=production, and the repo pre-commit hook builds with the developer's
 * `.env.local` (USE_MOCK_DATA=true for mock dev); a hard failure there would
 * break every mock-dev build for no real gain, since `docker build` excludes
 * `.env*` and is therefore always built in real mode. The non-bypassable block
 * lives in the runtime gate, where NODE_ENV=production genuinely means "prod
 * server". Tolerates a missing BFF_API_URL (build has no runtime env).
 */
export function assertBuildEnv(): void {
  parse();
  if (isProdMock()) console.warn(PROD_MOCK_MESSAGE);
}

/**
 * Runtime boot gate (instrumentation register). Hard-blocks prod+mock and, in
 * real mode, requires BFF_API_URL.
 */
export function assertRuntimeEnv(): void {
  const env = parse();
  if (isProdMock()) throw new Error(PROD_MOCK_MESSAGE);
  if (!isMock() && !env.BFF_API_URL) {
    throw new Error(
      '[env] BFF_API_URL is required in real mode (USE_MOCK_DATA!=="true"). ' +
        'Set BFF_API_URL to the upstream BFF base URL, or set USE_MOCK_DATA=true for local mock.',
    );
  }
}
