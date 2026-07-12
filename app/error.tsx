'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/app/components/ui/state/ErrorState';
import { reportClientError } from '@/lib/client-error-report';

/**
 * Root segment boundary — covers the page segments below the root layout.
 * The layout is alive here, so it reuses the themed `ErrorState`. The raw
 * `error.message` is never shown to users; only a generic copy + digest.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      type: 'boundary',
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorState
      title="화면을 표시하는 중 문제가 발생했습니다"
      message={error.digest ? `오류 코드: ${error.digest}` : '잠시 후 다시 시도해주세요.'}
      onRetry={reset}
    />
  );
}
