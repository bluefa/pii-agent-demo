'use client';

import { useState, useEffect, useCallback } from 'react';
import { getScanHistory, ScanHistoryResponse } from '@/app/lib/api/scan';
import { cn } from '@/lib/theme';

interface ScanHistoryListProps {
  projectId: string;
  limit?: number;
}

export const ScanHistoryList = ({ projectId, limit = 5 }: ScanHistoryListProps) => {
  const [data, setData] = useState<ScanHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getScanHistory(projectId, limit);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        <span className="ml-2 text-sm text-gray-500">이력 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500">이력을 불러오는데 실패했습니다.</p>
        <button
          onClick={fetchHistory}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        스캔 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
            <th className="px-3 py-2">일시</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2">소요시간</th>
            <th className="px-3 py-2 text-right">발견</th>
            <th className="px-3 py-2 text-right">변경</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.history.map((item) => (
            <tr key={item.scanId} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-700">
                {formatDate(item.completedAt)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    item.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      item.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                  {item.status === 'COMPLETED' ? '완료' : '실패'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600">
                {formatDuration(item.duration)}
              </td>
              <td className="px-3 py-2 text-right text-gray-700">
                {item.result?.totalFound ?? '-'}
              </td>
              <td className="px-3 py-2 text-right">
                {item.result ? (
                  <span className="text-gray-700">
                    {item.result.newFound > 0 && (
                      <span className="text-green-600">+{item.result.newFound}</span>
                    )}
                    {item.result.removed > 0 && (
                      <span className="text-red-600 ml-1">-{item.result.removed}</span>
                    )}
                    {item.result.newFound === 0 && item.result.removed === 0 && (
                      <span className="text-gray-400">-</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.total > limit && (
        <div className="text-center py-2 text-xs text-gray-500 border-t border-gray-100">
          총 {data.total}건 중 최근 {limit}건 표시
        </div>
      )}
    </div>
  );
};

export default ScanHistoryList;
