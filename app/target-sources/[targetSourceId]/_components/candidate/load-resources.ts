/**
 * Fetch the resource list, retrying on an empty result — or on an error the caller
 * classifies as retriable — until a non-empty result arrives or `maxAttempts` is
 * reached. Right after a scan the backend can briefly report zero resources before
 * the results materialize, so a scan-triggered load passes maxAttempts > 1; a plain
 * (initial/manual) load passes maxAttempts = 1, where an empty list is a legitimate
 * resting state and is not retried. `onBeforeRetry` spaces out the attempts.
 * `shouldRetryError` lets the caller stop immediately on aborts and non-retriable
 * failures (ADR-008 error classification) instead of burning the remaining attempts.
 */
export const fetchResourcesWithRetry = async <T>(
  fetchOnce: () => Promise<T[]>,
  maxAttempts: number,
  onBeforeRetry: () => Promise<void>,
  shouldRetryError: (error: unknown) => boolean = () => true,
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
      if (attempt < maxAttempts && shouldRetryError(error)) {
        await onBeforeRetry();
        continue;
      }
      throw error;
    }
  }
};
