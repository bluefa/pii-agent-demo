'use client';

import { useState, useEffect, useCallback } from 'react';
import { QueueBoardHeader } from '@/app/components/features/queue-board/QueueBoardHeader';
import { QueueBoardSummaryCards } from '@/app/components/features/queue-board/QueueBoardSummaryCards';
import { QueueBoardTabs } from '@/app/components/features/queue-board/QueueBoardTabs';
import { PendingTasksTable } from '@/app/components/features/queue-board/PendingTasksTable';
import { ProcessingTasksTable } from '@/app/components/features/queue-board/ProcessingTasksTable';
import { CompletedTasksTable } from '@/app/components/features/queue-board/CompletedTasksTable';
import { TaskRejectModal } from '@/app/components/features/queue-board/TaskRejectModal';
import { TaskDetailModal } from '@/app/components/features/queue-board/TaskDetailModal';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { fetchJson } from '@/lib/fetch-json';
import { AppError } from '@/lib/errors';
import { cn, textColors, primaryColors, cardStyles, statusColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem, ApprovalRequestQueueResponse } from '@/lib/types/queue-board';

type TabKey = 'pending' | 'processing' | 'completed';

const TAB_STATUS_MAP: Record<TabKey, string> = {
  pending: 'PENDING',
  processing: 'IN_PROGRESS',
  completed: 'APPROVED,REJECTED',
};

const PAGE_SIZE = 20;

export const QueueBoard = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [requestType, setRequestType] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApprovalRequestQueueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalRequestQueueItem | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<ApprovalRequestQueueItem | null>(null);

  const fetchData = useCallback(async (tab: TabKey, currentPage: number, type: string | null, query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: TAB_STATUS_MAP[tab],
        page: String(currentPage),
        size: String(PAGE_SIZE),
        sort: 'requestedAt,desc',
      });
      if (type) params.set('requestType', type);
      if (query) params.set('search', query);

      const result = await fetchJson<ApprovalRequestQueueResponse>(
        `/api/v1/task-admin/approval-requests?${params.toString()}`
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab, page, requestType, search);
  }, [activeTab, page, requestType, search, fetchData]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(0);
  };

  const handleRequestTypeChange = (value: string | null) => {
    setRequestType(value);
    setPage(0);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleReset = () => {
    setRequestType(null);
    setSearch('');
    setPage(0);
  };

  const handleApproveOpen = (item: ApprovalRequestQueueItem) => {
    setError(null);
    setApproveTarget(item);
    setApproveModalOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setError(null);
    try {
      await fetchJson(`/api/v1/target-sources/${approveTarget.targetSourceId}/approval-requests/approve`, {
        method: 'POST',
        body: {},
      });
      setApproveModalOpen(false);
      setApproveTarget(null);
      fetchData(activeTab, page, requestType, search);
    } catch (err) {
      setApproveModalOpen(false);
      setApproveTarget(null);
      if (err instanceof AppError && err.status === 409) {
        setError('다른 관리자가 이미 처리했습니다.');
        fetchData(activeTab, page, requestType, search);
      } else {
        setError('승인 처리에 실패했습니다.');
      }
    }
  };

  const handleRejectOpen = (item: ApprovalRequestQueueItem) => {
    setSelectedItem(item);
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!selectedItem) return;
    setError(null);
    try {
      await fetchJson(`/api/v1/target-sources/${selectedItem.targetSourceId}/approval-requests/reject`, {
        method: 'POST',
        body: { reason },
      });
      setRejectModalOpen(false);
      setSelectedItem(null);
      fetchData(activeTab, page, requestType, search);
    } catch (err) {
      setRejectModalOpen(false);
      setSelectedItem(null);
      if (err instanceof AppError && err.status === 409) {
        setError('다른 관리자가 이미 처리했습니다.');
        fetchData(activeTab, page, requestType, search);
      } else {
        setError('반려 처리에 실패했습니다.');
      }
    }
  };

  const handleDetail = (item: ApprovalRequestQueueItem) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  const items = data?.content ?? [];
  const pageInfo = data?.page;
  const totalPages = pageInfo?.totalPages ?? 0;
  const totalElements = pageInfo?.totalElements ?? 0;
  const pendingCount = pageInfo?.pendingCount ?? 0;
  const processingCount = pageInfo?.processingCount ?? 0;
  const approvedCount = pageInfo?.approvedCount ?? 0;
  const rejectedCount = pageInfo?.rejectedCount ?? 0;

  // Pagination: show max 5 page numbers around current page
  const paginationStart = Math.max(0, page - 2);
  const paginationEnd = Math.min(totalPages, paginationStart + 5);
  const pageNumbers = Array.from({ length: paginationEnd - paginationStart }, (_, i) => paginationStart + i);

  const rangeStart = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalElements);

  return (
    <div className="space-y-6">
      <QueueBoardHeader
        requestType={requestType}
        search={search}
        onRequestTypeChange={handleRequestTypeChange}
        onSearchChange={handleSearchChange}
        onReset={handleReset}
      />

      <QueueBoardSummaryCards
        pendingCount={pendingCount}
        processingCount={processingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
      />

      {error && (
        <div className={cn('flex items-center justify-between px-4 py-3 rounded-lg text-sm', statusColors.error.bg, statusColors.error.text)}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={cn('ml-3 flex-shrink-0', statusColors.error.text)}
            aria-label="에러 닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className={cn(cardStyles.base, 'overflow-hidden')}>
        <div className="px-6 pt-5 pb-3">
          <QueueBoardTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            pendingCount={pendingCount}
            processingCount={processingCount}
          />
        </div>

        {activeTab === 'pending' && (
          <PendingTasksTable
            items={items}
            loading={loading}
            onApprove={handleApproveOpen}
            onReject={handleRejectOpen}
            onDetail={handleDetail}
          />
        )}
        {activeTab === 'processing' && (
          <ProcessingTasksTable
            items={items}
            loading={loading}
            onDetail={handleDetail}
          />
        )}
        {activeTab === 'completed' && (
          <CompletedTasksTable
            items={items}
            loading={loading}
            onDetail={handleDetail}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className={cn('text-sm', textColors.tertiary)}>
              {totalElements}건 중 {rangeStart}-{rangeEnd} 표시
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  textColors.secondary,
                  'hover:bg-gray-100',
                )}
              >
                이전
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'w-8 h-8 text-sm rounded-md transition-colors flex items-center justify-center',
                    n === page
                      ? `${primaryColors.bg} text-white`
                      : `${textColors.tertiary} hover:bg-gray-100`,
                  )}
                >
                  {n + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  textColors.secondary,
                  'hover:bg-gray-100',
                )}
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      <TaskRejectModal
        isOpen={rejectModalOpen}
        onClose={() => { setRejectModalOpen(false); setSelectedItem(null); }}
        onConfirm={handleRejectConfirm}
        item={selectedItem}
      />

      <TaskDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
      />

      <Modal
        isOpen={approveModalOpen}
        onClose={() => { setApproveModalOpen(false); setApproveTarget(null); }}
        title="승인 확인"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setApproveModalOpen(false); setApproveTarget(null); }}>
              취소
            </Button>
            <Button onClick={handleApproveConfirm}>
              승인
            </Button>
          </>
        }
      >
        {approveTarget && (
          <p className={cn('text-sm', textColors.secondary)}>
            <span className="font-medium">{approveTarget.serviceCode}</span>
            {' '}
            {approveTarget.serviceName}
            <span className={cn('mx-1.5', textColors.quaternary)}>|</span>
            {approveTarget.requestTypeName}
            <span className={cn('block mt-2', textColors.primary)}>
              이 요청을 승인하시겠습니까?
            </span>
          </p>
        )}
      </Modal>
    </div>
  );
};
