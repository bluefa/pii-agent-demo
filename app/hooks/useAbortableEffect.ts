import { useEffect, type DependencyList } from 'react';
import { ignoreAborted } from '@/lib/errors';

/**
 * Effect that auto-cancels in-flight work when deps change or the component unmounts.
 *
 * Replaces the manual `let cancelled = false` flag pattern: each effect run gets a fresh
 * AbortController whose signal is passed to `run`. On cleanup, the controller aborts —
 * any pending fetch using that signal throws `AppError(code: 'ABORTED')`, which is
 * silently swallowed by `ignoreAborted`. Real errors still propagate.
 *
 * Contract: the caller's `deps` array must cover every reactive value `run`'s closure
 * reads. ESLint's `additionalHooks` config validates this at the call site.
 *
 * @example
 *   useAbortableEffect(async (signal) => {
 *     const data = await fetchSomething(id, { signal });
 *     setState(data);
 *   }, [id]);
 */
export function useAbortableEffect(
  run: (signal: AbortSignal) => void | Promise<void>,
  deps: DependencyList,
): void {
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve(run(controller.signal)).catch(ignoreAborted);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
