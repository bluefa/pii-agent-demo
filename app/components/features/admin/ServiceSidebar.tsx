'use client';

import { ServiceCode } from '@/lib/types';
import { primaryColors, textColors, cn, getInputClass } from '@/lib/theme';

const footerLinkClass = cn(
  'flex items-center gap-2 text-[13px] py-1.5 transition-colors',
  textColors.secondary,
  primaryColors.textHover,
);

const sidebarFooter = (
  <nav className="border-t border-gray-100 px-5 py-3 flex flex-col gap-1">
    <a href="#" className={footerLinkClass}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      Notice
    </a>
    <a href="#" className={footerLinkClass}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      Guide
    </a>
    <a href="#" className={footerLinkClass}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      FAQ
    </a>
  </nav>
);

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
    <aside className="w-[280px] shrink-0 bg-white shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>Service List</h2>
      </div>

      <div className="px-3 py-2 border-b border-gray-100">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Service name or Service Code"
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
          services.map((service) => {
            const isSelected = selectedService === service.code;
            return (
              <li
                key={service.code}
                onClick={() => onSelectService(service.code)}
                className={cn(
                  'mx-2 mb-0.5 cursor-pointer rounded-lg transition-all duration-150',
                  isSelected
                    ? cn('px-[13px] py-[11px] border', primaryColors.bgLight, primaryColors.border)
                    : 'px-[14px] py-3 hover:bg-gray-50',
                )}
              >
                <div className={cn('text-[13px] font-semibold', isSelected ? primaryColors.text : textColors.primary)}>
                  {service.code}
                </div>
                <div className={cn('text-xs mt-0.5', textColors.tertiary)}>
                  {service.name}
                </div>
              </li>
            );
          })
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

      {sidebarFooter}
    </aside>
  );
};
