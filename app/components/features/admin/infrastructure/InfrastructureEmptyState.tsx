'use client';

import { cn, textColors } from '@/lib/theme';

interface InfrastructureEmptyStateProps {
  onAddInfra: () => void;
}

const EMPTY_ICON = (
  <svg className={cn('w-8 h-8', textColors.quaternary)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

export const InfrastructureEmptyState = ({ onAddInfra }: InfrastructureEmptyStateProps) => {
  return (
    <div className="p-12 text-center bg-white rounded-xl border border-gray-200">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {EMPTY_ICON}
      </div>
      <p className={textColors.tertiary}>등록된 인프라가 없어요</p>
      <p className={cn('text-sm mt-1', textColors.quaternary)}>
        상단의 인프라 추가 버튼으로 새 대상을 등록하세요
      </p>
      <button
        type="button"
        onClick={onAddInfra}
        className="mt-4 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
      >
        인프라 추가
      </button>
    </div>
  );
};
