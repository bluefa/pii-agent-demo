'use client';

import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { cn, textColors } from '@/lib/theme';
import { InfraDbTable } from './InfraDbTable';

interface InfraCardBodyProps {
  resources: ConfirmedIntegrationResourceItem[] | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export const InfraCardBody = ({ resources, loading, error, onRetry }: InfraCardBodyProps) => {
  if (loading) {
    return (
      <div className="border-t border-gray-100 px-4 py-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('border-t border-gray-100 px-4 py-8 text-center text-sm', textColors.tertiary)}>
        확정 정보를 불러올 수 없어요.{' '}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="text-[var(--color-primary)] font-medium hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <div className={cn('border-t border-gray-100 px-4 py-8 text-center text-sm', textColors.tertiary)}>
        연동 확정된 DB가 없어요
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100">
      <InfraDbTable resources={resources} />
    </div>
  );
};
