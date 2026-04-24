'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { TaskRejectModal } from '@/app/components/features/queue-board/TaskRejectModal';
import { TaskDetailModal } from '@/app/components/features/queue-board/TaskDetailModal';
import { cn, textColors } from '@/lib/theme';
import type { ApprovalRequestQueueItem } from '@/lib/types/queue-board';

export type ModalState =
  | { type: 'none' }
  | { type: 'reject'; item: ApprovalRequestQueueItem }
  | { type: 'detail'; item: ApprovalRequestQueueItem }
  | { type: 'approve'; item: ApprovalRequestQueueItem };

export const MODAL_CLOSED: ModalState = { type: 'none' };

interface QueueBoardModalsProps {
  modal: ModalState;
  onClose: () => void;
  onApproveConfirm: () => void;
  onRejectConfirm: (reason: string) => Promise<void> | void;
}

export const QueueBoardModals = ({
  modal,
  onClose,
  onApproveConfirm,
  onRejectConfirm,
}: QueueBoardModalsProps) => (
  <>
    <TaskRejectModal
      isOpen={modal.type === 'reject'}
      onClose={onClose}
      onConfirm={onRejectConfirm}
      item={modal.type === 'reject' ? modal.item : null}
    />

    <TaskDetailModal
      isOpen={modal.type === 'detail'}
      onClose={onClose}
      item={modal.type === 'detail' ? modal.item : null}
    />

    <Modal
      isOpen={modal.type === 'approve'}
      onClose={onClose}
      title="승인 확인"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onApproveConfirm}>승인</Button>
        </>
      }
    >
      {modal.type === 'approve' && (
        <p className={cn('text-sm', textColors.secondary)}>
          <span className="font-medium">{modal.item.serviceCode}</span>
          {' '}
          {modal.item.serviceName}
          <span className={cn('mx-1.5', textColors.quaternary)}>|</span>
          {modal.item.requestTypeName}
          <span className={cn('block mt-2', textColors.primary)}>
            이 요청을 승인하시겠습니까?
          </span>
        </p>
      )}
    </Modal>
  </>
);
