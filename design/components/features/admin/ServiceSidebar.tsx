'use client';

import { ServiceCode } from '@/lib/types';
import { statusColors, primaryColors, textColors, cn, getInputClass } from '@/lib/theme';

interface ServicePageInfo {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface ServiceSidebarProps {
  services: ServiceCode[];
  selectedService: string | null;
  onSelectService: (code: string) => void;
  projectCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pageInfo: ServicePageInfo;
  onPageChange: (page: number) => void;
}

export const ServiceSidebar = ({
  services,
  selectedService,
  onSelectService,
  projectCount,
  searchQuery,
  onSearchChange,
  pageInfo,
  onPageChange,
}: ServiceSidebarProps) => {
  const { totalElements, totalPages, number: currentPage } = pageInfo;

  const paginationStart = Math.max(0, currentPage - 2);
  const paginationEnd = Math.min(totalPages, paginationStart + 5);
  const pageNumbers = Array.from({ length: paginationEnd - paginationStart }, (_, i) => paginationStart + i);

  return (
    <aside className="w-64 bg-white shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className={cn('text-xs font-semibold uppercase tracking-wider', textColors.quaternary)}>서비스 코드</h2>
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="서비스 검색..."
          className={cn(getInputClass(), '!py-2 !px-3 text-sm')}
        />
      </div>

      <ul className="py-2 flex-1 overflow-auto">
        {services.length === 0 ? (
          <li className="px-4 py-8 text-center">
            <p className={cn('text-sm', textColors.tertiary)}>검색 결과가 없습니다</p>
            <p className={cn('text-xs mt-1', textColors.quaternary)}>다른 검색어를 입력해 주세요</p>
          </li>
        ) : (
          services.map((service) => (
            <li
              key={service.code}
              onClick={() => onSelectService(service.code)}
              className={cn(
                'mx-2 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150',
                selectedService === service.code
                  ? `${statusColors.info.bgLight} border-l-4 border-l-blue-500 shadow-sm`
                  : 'hover:bg-gray-50 border-l-4 border-l-transparent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('font-medium', selectedService === service.code ? statusColors.info.textDark : 'text-gray-900')}>
                  {service.code}
                </span>
                {selectedService === service.code && projectCount > 0 && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColors.info.bg, primaryColors.text)}>
                    {projectCount}
                  </span>
                )}
              </div>
              <div className={cn('text-sm', selectedService === service.code ? primaryColors.text : textColors.tertiary)}>
                {service.name}
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 && (
        <div className="px-3 py-3 border-t border-gray-100">
          <p className={cn('text-xs mb-2 text-center', textColors.quaternary)}>
            총 {totalElements}개 서비스
          </p>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                textColors.tertiary,
                'hover:bg-gray-100',
              )}
              aria-label="이전 페이지"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPageChange(n)}
                className={cn(
                  'w-7 h-7 text-xs rounded-md transition-colors flex items-center justify-center',
                  n === currentPage
                    ? `${primaryColors.bg} text-white`
                    : `${textColors.tertiary} hover:bg-gray-100`,
                )}
              >
                {n + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                textColors.tertiary,
                'hover:bg-gray-100',
              )}
              aria-label="다음 페이지"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
