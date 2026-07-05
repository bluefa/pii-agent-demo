/**
 * mapPool — run `fn` over `items` with at most `limit` in flight (pure, testable).
 *
 * `shouldContinue` is checked before STARTING each item: once it returns false,
 * no new item is launched — items already in flight are allowed to finish (we
 * cannot abort them mid-request, and their results are simply discarded by the
 * caller's cancelled-guard). Used by the pipeline detail page to stop the
 * task-detail fan-out after unmount / route change.
 *
 * NOTE: when aborted early the result array is SPARSE (unstarted slots are
 * holes). Callers must compact it (e.g. `.filter(...)`, which skips holes)
 * before consuming.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  shouldContinue: () => boolean = () => true,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (shouldContinue() && cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
