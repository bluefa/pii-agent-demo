'use client';

import { useState } from 'react';
import type { TestConnectionJob } from '@/app/lib/api';
import { getTestConnectionResults } from '@/app/lib/api';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { statusColors, getButtonClass, cn } from '@/lib/theme';
import { HistoryJobCard } from './HistoryJobCard';

interface TestConnectionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSourceId: number;
}

export const TestConnectionHistoryModal = ({
  isOpen,
  onClose,
  targetSourceId,
}: TestConnectionHistoryModalProps) => {
  const [jobs, setJobs] = useState<TestConnectionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 5;

  useAbortableEffect((signal) => {
    if (!isOpen) return;
    setLoading(true);
    void getTestConnectionResults(targetSourceId, page, PAGE_SIZE, { signal })
      .then((res) => {
        if (signal.aborted) return;
        setJobs(res.content);
        setTotal(res.page.totalElements);
      })
      .catch(() => {
        if (!signal.aborted) setJobs([]);
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
  }, [isOpen, targetSourceId, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="연결 테스트 내역"
      subtitle={total > 0 ? `총 ${total}건` : undefined}
      size="xl"
      icon={
        <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      footer={
        totalPages > 1 ? (
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={getButtonClass('ghost', 'sm')}
            >
              이전
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={getButtonClass('ghost', 'sm')}
            >
              다음
            </button>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-gray-500">내역 로딩 중...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">연결 테스트 내역이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <HistoryJobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </Modal>
  );
};
