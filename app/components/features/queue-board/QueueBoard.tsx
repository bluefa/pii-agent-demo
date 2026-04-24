'use client';

import { useCallback, useState } from 'react';
import { QueueBoardHeader } from '@/app/components/features/queue-board/QueueBoardHeader';
import { QueueBoardSummaryCards } from '@/app/components/features/queue-board/QueueBoardSummaryCards';
import { QueueBoardTabs } from '@/app/components/features/queue-board/QueueBoardTabs';
import { QueueBoardPagination } from '@/app/components/features/queue-board/QueueBoardPagination';
import { PendingTasksTable } from '@/app/components/features/queue-board/PendingTasksTable';
import { ProcessingTasksTable } from '@/app/components/features/queue-board/ProcessingTasksTable';
import { CompletedTasksTable } from '@/app/components/features/queue-board/CompletedTasksTable';
import { MODAL_CLOSED, QueueBoardModals, type ModalState } from '@/app/components/features/queue-board/QueueBoardModals';
import { PAGE_SIZE, useQueueBoardData } from '@/app/components/features/queue-board/useQueueBoardData';
import { fetchInfraJson } from '@/app/lib/api/infra';
import { AppError } from '@/lib/errors';
import { cn, cardStyles, statusColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem } from '@/lib/types/queue-board';

export const QueueBoard = () => {
  const {
    activeTab, requestType, search, page, data, loading,
    setActiveTab, setRequestType, setSearch, setPage, reset, refresh,
  } = useQueueBoardData();

  const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => setModal(MODAL_CLOSED), []);

  const handleApproveConfirm = useCallback(async () => {
    if (modal.type !== 'approve') return;
    const item = modal.item;
    setError(null);
    try {
      await fetchInfraJson(
        `/target-sources/${item.targetSourceId}/approval-requests/approve`,
        { method: 'POST', body: {} },
      );
      setModal(MODAL_CLOSED);
      refresh();
    } catch (err) {
      setModal(MODAL_CLOSED);
      if (err instanceof AppError && err.status === 409) {
        setError('다른 관리자가 이미 처리했습니다.');
        refresh();
      } else {
        setError('승인 처리에 실패했습니다.');
      }
    }
  }, [modal, refresh]);

  const handleRejectConfirm = useCallback(
    async (reason: string) => {
      if (modal.type !== 'reject') return;
      const item = modal.item;
      setError(null);
      try {
        await fetchInfraJson(
          `/target-sources/${item.targetSourceId}/approval-requests/reject`,
          { method: 'POST', body: { reason } },
        );
        setModal(MODAL_CLOSED);
        refresh();
      } catch (err) {
        setModal(MODAL_CLOSED);
        if (err instanceof AppError && err.status === 409) {
          setError('다른 관리자가 이미 처리했습니다.');
          refresh();
        } else {
          setError('반려 처리에 실패했습니다.');
        }
      }
    },
    [modal, refresh],
  );

  const handleApproveOpen = (item: ApprovalRequestQueueItem) => {
    setError(null);
    setModal({ type: 'approve', item });
  };
  const handleRejectOpen = (item: ApprovalRequestQueueItem) =>
    setModal({ type: 'reject', item });
  const handleDetail = (item: ApprovalRequestQueueItem) =>
    setModal({ type: 'detail', item });

  const items = data?.content ?? [];
  const pageInfo = data?.page;
  const totalPages = pageInfo?.totalPages ?? 0;
  const totalElements = pageInfo?.totalElements ?? 0;
  const pendingCount = pageInfo?.pendingCount ?? 0;
  const processingCount = pageInfo?.processingCount ?? 0;
  const approvedCount = pageInfo?.approvedCount ?? 0;
  const rejectedCount = pageInfo?.rejectedCount ?? 0;

  return (
    <div className="space-y-6">
      <QueueBoardHeader
        requestType={requestType}
        search={search}
        onRequestTypeChange={setRequestType}
        onSearchChange={setSearch}
        onReset={reset}
      />

      <QueueBoardSummaryCards
        pendingCount={pendingCount}
        processingCount={processingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
      />

      {error && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 rounded-lg text-sm',
            statusColors.error.bg,
            statusColors.error.text,
          )}
        >
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
            onTabChange={setActiveTab}
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
          <ProcessingTasksTable items={items} loading={loading} onDetail={handleDetail} />
        )}
        {activeTab === 'completed' && (
          <CompletedTasksTable items={items} loading={loading} onDetail={handleDetail} />
        )}

        <QueueBoardPagination
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <QueueBoardModals
        modal={modal}
        onClose={closeModal}
        onApproveConfirm={handleApproveConfirm}
        onRejectConfirm={handleRejectConfirm}
      />
    </div>
  );
};
