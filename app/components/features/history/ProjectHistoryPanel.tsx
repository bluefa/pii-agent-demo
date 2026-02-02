'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProjectHistory } from '@/lib/types';
import { ProjectHistoryFilter, HistoryFilterType } from './ProjectHistoryFilter';
import { ProjectHistoryTable } from './ProjectHistoryTable';
import { cardStyles, cn } from '@/lib/theme';

interface ProjectHistoryPanelProps {
  projectId: string;
  initialHistory?: ProjectHistory[];
  title?: string;
}

interface HistoryResponse {
  history: ProjectHistory[];
  total: number;
}

export const ProjectHistoryPanel = ({
  projectId,
  initialHistory,
  title = '프로젝트 이력',
}: ProjectHistoryPanelProps) => {
  const [filter, setFilter] = useState<HistoryFilterType>('all');
  const [history, setHistory] = useState<ProjectHistory[]>(initialHistory ?? []);
  const [total, setTotal] = useState(initialHistory?.length ?? 0);
  const [loading, setLoading] = useState(!initialHistory);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: filter,
        limit: '50',
        offset: '0',
      });

      const response = await fetch(`/api/projects/${projectId}/history?${params}`);

      if (!response.ok) {
        throw new Error('이력을 불러오는데 실패했습니다.');
      }

      const data: HistoryResponse = await response.json();
      setHistory(data.history);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className={cn(cardStyles.base, 'overflow-hidden')}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {total > 0 && (
            <span className="text-sm text-gray-500">({total}건)</span>
          )}
        </div>
        <ProjectHistoryFilter value={filter} onChange={setFilter} />
      </div>

      {/* Content */}
      <div className="p-0">
        {error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <ProjectHistoryTable history={history} loading={loading} />
        )}
      </div>
    </div>
  );
};
