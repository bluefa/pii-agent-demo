/**
 * Fetch the resource list, retrying on an error OR an empty result until a
 * non-empty result arrives or `maxAttempts` is reached. Right after a scan the
 * backend can briefly report zero resources before the results materialize, so a
 * scan-triggered load passes maxAttempts > 1; a plain (initial/manual) load passes
 * maxAttempts = 1, where an empty list is a legitimate resting state and is not
 * retried. `onBeforeRetry` spaces out the attempts (and short-circuits on abort).
 */
export const fetchResourcesWithRetry = async <T>(
  fetchOnce: () => Promise<T[]>,
  maxAttempts: number,
  onBeforeRetry: () => Promise<void>,
): Promise<T[]> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const data = await fetchOnce();
      if (data.length === 0 && attempt < maxAttempts) {
        await onBeforeRetry();
        continue;
      }
      return data;
    } catch (error) {
      if (attempt < maxAttempts) {
        await onBeforeRetry();
        continue;
      }
      throw error;
    }
  }
};
