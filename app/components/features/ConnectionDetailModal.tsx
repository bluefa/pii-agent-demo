'use client';

import { ConnectionTestHistory } from '@/lib/types';
import { DatabaseIcon, getDatabaseLabel } from '@/app/components/ui/DatabaseIcon';
import { formatDateTimeSeconds } from '@/lib/utils/date';
import { ERROR_TYPE_LABELS } from '@/lib/constants/labels';
import { Badge } from '@/app/components/ui/Badge';

interface ConnectionDetailModalProps {
  history: ConnectionTestHistory;
  onClose: () => void;
}

const RESOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  RDS: (
    <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill="#3B48CC" />
      <path d="M20 8c-5.5 0-10 2-10 4.5v15c0 2.5 4.5 4.5 10 4.5s10-2 10-4.5v-15c0-2.5-4.5-4.5-10-4.5z" fill="#5294CF" />
      <ellipse cx="20" cy="12.5" rx="10" ry="4.5" fill="#1A476F" />
    </svg>
  ),
  DYNAMODB: (
    <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill="#3B48CC" />
      <path d="M8 12l12-4 12 4v16l-12 4-12-4V12z" fill="#5294CF" />
      <ellipse cx="20" cy="12" rx="12" ry="4" fill="#2E73B8" />
    </svg>
  ),
  ATHENA: (
    <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill="#8C4FFF" />
      <path d="M20 8l10 6v12l-10 6-10-6V14l10-6z" fill="#B98AFF" />
    </svg>
  ),
  REDSHIFT: (
    <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="4" fill="#205B99" />
      <path d="M10 14h20v16H10V14z" fill="#5294CF" />
    </svg>
  ),
};

const DefaultIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="4" fill="#6B7280" />
    <ellipse cx="20" cy="12" rx="10" ry="4" fill="#9CA3AF" />
    <path d="M10 12v16c0 2.2 4.5 4 10 4s10-1.8 10-4V12" fill="#4B5563" />
  </svg>
);

export const ConnectionDetailModal = ({ history, onClose }: ConnectionDetailModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Test Connection 상세</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">실행 일시</p>
              <p className="font-medium text-gray-900">{formatDateTimeSeconds(history.executedAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">결과</p>
              <div className="flex items-center gap-2">
                <Badge variant={history.status === 'SUCCESS' ? 'success' : 'error'} size="md">
                  {history.status === 'SUCCESS' ? 'SUCCESS' : 'FAIL'}
                </Badge>
                <span className="text-sm text-gray-600">
                  (성공 {history.successCount}개 / 실패 {history.failCount}개)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-auto max-h-[400px]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">인스턴스 타입</th>
                <th className="px-6 py-3">데이터베이스</th>
                <th className="px-6 py-3">리소스 ID</th>
                <th className="px-6 py-3">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.results.map((result, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {RESOURCE_TYPE_ICONS[result.resourceType] || <DefaultIcon />}
                      <span className="font-medium text-gray-900">{result.resourceType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <DatabaseIcon type={result.databaseType} size="sm" />
                      <span className="text-sm text-gray-700">{getDatabaseLabel(result.databaseType)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 font-mono text-sm">{result.resourceId}</span>
                  </td>
                  <td className="px-6 py-4">
                    {result.success ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span>성공</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 text-red-600">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span>{result.error ? ERROR_TYPE_LABELS[result.error.type] || '실패' : '실패'}</span>
                        </div>
                        {result.error && (
                          <p className="text-xs text-red-400 mt-1 ml-4">{result.error.message}</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
