'use client';

import { ErrorState } from './common';

export default function ProjectDetailError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return <ErrorState error={error.message || '과제를 불러오는데 실패했습니다.'} />;
}
