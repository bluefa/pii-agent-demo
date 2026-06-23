'use client';

import { Modal } from '@/app/components/ui/Modal';
import { statusColors, textColors, cn } from '@/lib/theme';

interface TestConnectionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSourceId: number;
}

// ADR-019 migration spec §5.4: the new /install/v1 contract has no paginated
// test-connection history endpoint (the old `…/test-connection/results?page&size`
// was dropped in favour of `latest_version` / `latest-results`). Until a history
// source is published, this modal renders an empty state instead of calling a
// non-existent endpoint. `targetSourceId` is retained for the future re-wire.
export const TestConnectionHistoryModal = ({
  isOpen,
  onClose,
}: TestConnectionHistoryModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="연결 테스트 내역"
    size="xl"
    icon={
      <svg className={cn('w-5 h-5', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    }
  >
    <div className={cn('text-center py-8 text-sm', textColors.quaternary)}>연결 테스트 내역이 없습니다.</div>
  </Modal>
);
