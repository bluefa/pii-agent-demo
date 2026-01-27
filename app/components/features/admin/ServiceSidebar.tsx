'use client';

import { ServiceCode, ProjectSummary } from '@/lib/types';

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
            className={`mx-2 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150 ${
              selectedService === service.code
                ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm'
                : 'hover:bg-gray-50 border-l-4 border-l-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-medium ${selectedService === service.code ? 'text-blue-700' : 'text-gray-900'}`}>
                {service.code}
              </span>
              {selectedService === service.code && projectCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {projectCount}
                </span>
              )}
            </div>
            <div className={`text-sm ${selectedService === service.code ? 'text-blue-600' : 'text-gray-500'}`}>
              {service.name}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};
