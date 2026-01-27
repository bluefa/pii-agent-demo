import { useState, useCallback } from 'react';

export interface UseApiMutationOptions<TData, TResult> {
  /** 성공 시 콜백 */
  onSuccess?: (result: TResult, data: TData) => void;
  /** 에러 시 콜백 */
  onError?: (error: Error, data: TData) => void;
  /** 에러 시 표시할 기본 메시지 */
  errorMessage?: string;
  /** alert 대신 커스텀 에러 핸들링 사용 */
  suppressAlert?: boolean;
}

export interface UseApiMutationReturn<TData, TResult> {
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 객체 */
  error: Error | null;
  /** mutation 실행 함수 */
  mutate: (data: TData) => Promise<TResult | undefined>;
  /** 상태 초기화 */
  reset: () => void;
}

/**
 * API mutation 작업을 위한 훅
 *
 * try-catch-finally 패턴을 추상화하여 로딩/에러 상태를 자동 관리합니다.
 *
 * @template TData - mutation에 전달할 데이터 타입
 * @template TResult - API 응답 타입
 *
 * @example
 * // 기본 사용
 * const { mutate, loading } = useApiMutation(
 *   (data: { name: string }) => createProject(data),
 *   {
 *     onSuccess: (result) => {
 *       setProject(result);
 *       closeModal();
 *     },
 *     errorMessage: '프로젝트 생성에 실패했습니다.',
 *   }
 * );
 *
 * const handleSubmit = () => {
 *   mutate({ name: projectName });
 * };
 *
 * @example
 * // 파라미터 없는 mutation
 * const { mutate: runTest, loading: testLoading } = useApiMutation(
 *   () => runConnectionTest(projectId),
 *   {
 *     onSuccess: (result) => setTestResult(result),
 *   }
 * );
 */
export const useApiMutation = <TData, TResult>(
  mutationFn: (data: TData) => Promise<TResult>,
  options: UseApiMutationOptions<TData, TResult> = {}
): UseApiMutationReturn<TData, TResult> => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { onSuccess, onError, errorMessage, suppressAlert = false } = options;

  const mutate = useCallback(
    async (data: TData): Promise<TResult | undefined> => {
      try {
        setLoading(true);
        setError(null);
        const result = await mutationFn(data);
        onSuccess?.(result, data);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (onError) {
          onError(error, data);
        } else if (!suppressAlert) {
          alert(errorMessage || error.message || '작업에 실패했습니다.');
        }
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, onSuccess, onError, errorMessage, suppressAlert]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, mutate, reset };
};

/**
 * 파라미터 없는 mutation을 위한 단순화된 훅
 *
 * @example
 * const { execute, loading } = useApiAction(
 *   () => approveProject(projectId),
 *   {
 *     onSuccess: (result) => setProject(result),
 *   }
 * );
 */
export const useApiAction = <TResult>(
  actionFn: () => Promise<TResult>,
  options: Omit<UseApiMutationOptions<void, TResult>, 'onError' | 'onSuccess'> & {
    onSuccess?: (result: TResult) => void;
    onError?: (error: Error) => void;
  } = {}
): Omit<UseApiMutationReturn<void, TResult>, 'mutate'> & { execute: () => Promise<TResult | undefined> } => {
  const { loading, error, mutate, reset } = useApiMutation<void, TResult>(
    () => actionFn(),
    {
      ...options,
      onSuccess: options.onSuccess ? (result) => options.onSuccess!(result) : undefined,
      onError: options.onError ? (err) => options.onError!(err) : undefined,
    }
  );

  const execute = useCallback(() => mutate(undefined as void), [mutate]);

  return { loading, error, execute, reset };
};

export default useApiMutation;
