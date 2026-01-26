import { useState, useCallback } from 'react';

interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseAsyncReturn<T, Args extends unknown[]> {
  loading: boolean;
  error: Error | null;
  execute: (...args: Args) => Promise<T | undefined>;
}

export const useAsync = <T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, Args> => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { onSuccess, onError, errorMessage } = options;

  const execute = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      try {
        setLoading(true);
        setError(null);
        const result = await asyncFn(...args);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (onError) {
          onError(error);
        } else {
          alert(errorMessage || error.message || '작업에 실패했습니다.');
        }
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn, onSuccess, onError, errorMessage]
  );

  return { loading, error, execute };
};
