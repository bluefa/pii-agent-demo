'use client';

import { Resource } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';

interface IdcPendingResourceListProps {
  resources: Resource[];
  onRemove: (resourceId: string) => void;
}

export const IdcPendingResourceList = ({
  resources,
  onRemove,
}: IdcPendingResourceListProps) => {
  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-6 py-3">데이터베이스</th>
            <th className="px-6 py-3">리소스 ID</th>
            <th className="px-6 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {resources.map((resource) => (
            <tr key={resource.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <DatabaseIcon type={resource.databaseType} size="sm" />
                  <span className="text-sm text-gray-700">
                    {getDatabaseLabel(resource.databaseType)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-600 font-mono text-sm">{resource.resourceId}</span>
              </td>
              <td className="px-6 py-4">
                <button
                  onClick={() => onRemove(resource.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="삭제"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
