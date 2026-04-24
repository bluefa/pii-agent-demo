'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ page, totalPages, totalCount, onPageChange }: PaginationProps) => {
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const pages: (number | 'ellipsis')[] = [0];
    if (page > 2) pages.push('ellipsis');

    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 3) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages - 1);

    return pages;
  };

  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderTop: '1px solid #f3f4f6' }}
    >
      <span className="text-sm" style={{ color: '#6b7280' }}>
        총 <span className="font-medium" style={{ color: '#374151' }}>{totalCount.toLocaleString('ko-KR')}</span>건
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="이전 페이지"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {getPageNumbers().map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-sm" style={{ color: '#9ca3af' }}>
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className="w-8 h-8 flex items-center justify-center text-sm rounded-lg transition-all duration-150"
              style={
                item === page
                  ? {
                      background: 'linear-gradient(135deg, #0064FF 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      boxShadow: '0 1px 3px 0 rgba(0, 100, 255, 0.3)',
                    }
                  : { color: '#6b7280' }
              }
              onMouseEnter={(e) => {
                if (item !== page) e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                if (item !== page) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {item + 1}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="다음 페이지"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
