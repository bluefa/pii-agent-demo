import { assertRuntimeEnv } from '@/lib/env';

/**
 * The nodejs half of `register()`, split out so `process.exit` never lands in the
 * edge bundle. Next compiles `instrumentation.ts` for *both* runtimes, and the
 * `NEXT_RUNTIME` guard there is a runtime check — the bundler still reads the
 * `process.exit` call statically and warns on every boot. A dynamic `import()`
 * behind that guard moves the call into its own chunk, which only the nodejs
 * build pulls in.
 *
 * Top-level side effect on purpose: the import *is* the check.
 */
try {
  assertRuntimeEnv();
} catch (err) {
  // Exit deterministically rather than throw: Next binds the HTTP listener
  // before the instrumentation hook rejects, so a throw leaves a broken
  // server *listening* (an unhandledRejection). A PII server must die loudly.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
