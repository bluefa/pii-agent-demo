import { useState, useCallback, useEffect, useRef } from 'react';
import { toastGlobal } from '@/app/components/ui/toast/toastBus';
import { useLocale } from '@/app/components/LocaleProvider';
import { HOOKS_COPY } from '@/app/hooks/copy';

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
  const { locale } = useLocale();
  // A ref, not a dependency of `execute`: callers put `execute` in their own dependency
  // lists, so flipping the language toggle would rebuild their callbacks. The wording is
  // only read when the call fails, so the ref holds the language in force at that moment.
  const failedRef = useRef(HOOKS_COPY[locale].asyncAction.failed);
  useEffect(() => {
    failedRef.current = HOOKS_COPY[locale].asyncAction.failed;
  }, [locale]);

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
          toastGlobal()?.error(errorMessage || error.message || failedRef.current);
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
