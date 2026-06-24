'use client';

import type { TestConnectionVersionResult } from '@/app/lib/api';
import { Modal } from '@/app/components/ui/Modal';
import { statusColors, cn } from '@/lib/theme';
import { ResourceResultRow } from '@/app/components/features/process-status/connection-test/ResourceResultRow';

interface ResultDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: TestConnectionVersionResult;
}

export const ResultDetailModal = ({ isOpen, onClose, job }: ResultDetailModalProps) => {
  const failCount = job.testConnectionAgentResults.filter((r) => r.connectionStatus === 'FAIL').length;
  const successCount = job.testConnectionAgentResults.filter((r) => r.connectionStatus === 'SUCCESS').length;
  const dateStr = new Date(job.completedAt || job.requestedAt || '').toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="연결 테스트 결과"
      subtitle={`${dateStr} · ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ''}`}
      size="lg"
      icon={
        failCount > 0 ? (
          <svg className={cn('w-5 h-5', statusColors.error.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className={cn('w-5 h-5', statusColors.success.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      }
    >
      <div className="max-h-[400px] overflow-auto">
        {job.testConnectionAgentResults.map((r) => (
          <ResourceResultRow key={r.resourceId} result={r} />
        ))}
      </div>
    </Modal>
  );
};
