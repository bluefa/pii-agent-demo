'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProjectHistory } from '@/lib/types';
import { ProjectHistoryFilter, HistoryFilterType } from './ProjectHistoryFilter';
import { ProjectHistoryTable } from './ProjectHistoryTable';
import { ProjectHistoryDetailModal } from './ProjectHistoryDetailModal';
import { cardStyles, cn } from '@/lib/theme';

const ITEMS_PER_PAGE = 5;

interface ProjectHistoryPanelProps {
  projectId: string;
  initialHistory?: ProjectHistory[];
  title?: string;
  embedded?: boolean;
}

interface HistoryResponse {
  history: ProjectHistory[];
  total: number;
}

export const ProjectHistoryPanel = ({
  projectId,
  initialHistory,
  title = '프로젝트 이력',
  embedded = false,
}: ProjectHistoryPanelProps) => {
  const [filter, setFilter] = useState<HistoryFilterType>('all');
  const [history, setHistory] = useState<ProjectHistory[]>(initialHistory ?? []);
  const [total, setTotal] = useState(initialHistory?.length ?? 0);
  const [loading, setLoading] = useState(!initialHistory);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProjectHistory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const params = new URLSearchParams({
        type: filter,
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
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
  }, [projectId, filter, currentPage]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // 필터 변경 시 첫 페이지로 리셋
  const handleFilterChange = (newFilter: HistoryFilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  return (
    <div className={cn(embedded ? '' : cardStyles.base, 'overflow-hidden')}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between',
        embedded ? 'pb-4' : 'px-6 py-4 border-b border-gray-100'
      )}>
        {!embedded && (
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        )}
        <ProjectHistoryFilter value={filter} onChange={handleFilterChange} />
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
          <>
            <ProjectHistoryTable
              history={history}
              loading={loading}
              onRowClick={setSelectedItem}
            />
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <ProjectHistoryDetailModal
          history={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};
