'use client';

import { useState } from 'react';
import { ConnectionTestHistory } from '../../../lib/types';
import { ConnectionDetailModal } from './ConnectionDetailModal';
import { formatDateTime } from '../../../lib/utils/date';

interface ConnectionHistoryTabProps {
  history: ConnectionTestHistory[];
}

export const ConnectionHistoryTab = ({ history }: ConnectionHistoryTabProps) => {
  const [selectedHistory, setSelectedHistory] = useState<ConnectionTestHistory | null>(null);

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">연결 테스트 이력이 없습니다.</p>
        <p className="text-sm text-gray-400 mt-1">Test Connection을 실행하면 이력이 표시됩니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">실행 일시</th>
              <th className="px-6 py-3">결과</th>
              <th className="px-6 py-3">성공</th>
              <th className="px-6 py-3">실패</th>
              <th className="px-6 py-3 w-24">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatDateTime(item.executedAt)}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'SUCCESS'
                      ? 'bg-green-100 text-green-800'
                      : item.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-green-600 font-medium">
                  {item.successCount}개
                </td>
                <td className="px-6 py-4 text-sm text-red-600 font-medium">
                  {item.failCount}개
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedHistory(item)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedHistory && (
        <ConnectionDetailModal
          history={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </>
  );
};
