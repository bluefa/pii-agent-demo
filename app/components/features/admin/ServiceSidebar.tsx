'use client';

import { ServiceCode, ProjectSummary } from '@/lib/types';
import { statusColors, primaryColors, cn } from '@/lib/theme';

interface ServiceSidebarProps {
  services: ServiceCode[];
  selectedService: string | null;
  onSelectService: (code: string) => void;
  projectCount: number;
}

export const ServiceSidebar = ({
  services,
  selectedService,
  onSelectService,
  projectCount,
}: ServiceSidebarProps) => {
  return (
    <aside className="w-64 bg-white shadow-sm overflow-auto">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">서비스 코드</h2>
      </div>
      <ul className="py-2">
        {services.map((service) => (
          <li
            key={service.code}
            onClick={() => onSelectService(service.code)}
            className={cn(
              'mx-2 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150',
              selectedService === service.code
                ? `${statusColors.info.bgLight} border-l-4 border-l-blue-500 shadow-sm` // TODO: add dedicated active-indicator token for border-l-blue-500
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
            <div className={cn('text-sm', selectedService === service.code ? primaryColors.text : 'text-gray-500')}>
              {service.name}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};
