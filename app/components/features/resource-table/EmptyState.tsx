'use client';

export type FilterType = 'all' | 'selected';

interface EmptyStateProps {
  filter: FilterType;
}

const messages: Record<FilterType, string> = {
  all: '리소스가 없습니다.',
  selected: '연동 대상으로 선택된 리소스가 없습니다.',
};

export const EmptyState = ({ filter }: EmptyStateProps) => {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
          />
        </svg>
      </div>
      <p className="text-gray-500">{messages[filter]}</p>
    </div>
  );
};
