'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, textColors, statusColors, getInputClass } from '@/lib/theme';
import type { ApprovalRequestQueueItem } from '@/lib/types/queue-board';

interface TaskRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  item: ApprovalRequestQueueItem | null;
}

export const TaskRejectModal = ({
  isOpen,
  onClose,
  onConfirm,
  item,
}: TaskRejectModalProps) => {
  const [reason, setReason] = useState('');

  // Reset reason when modal opens/closes
  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 반려"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            반려
          </Button>
        </>
      }
    >
      {item && (
        <div className="space-y-4">
          {/* Target summary */}
          <p className={cn('text-sm', textColors.secondary)}>
            <span className="font-medium">{item.serviceCode}</span>
            {' '}
            {item.serviceName}
            <span className={cn('mx-1.5', textColors.quaternary)}>|</span>
            {item.requestTypeName}
          </p>

          {/* Rejection reason textarea */}
          <div>
            <label
              htmlFor="reject-reason"
              className={cn('block text-sm font-medium mb-1.5', textColors.secondary)}
            >
              반려 사유 <span className={statusColors.error.text}>*</span>
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려 사유를 입력하세요"
              rows={4}
              className={cn(getInputClass(), 'resize-none')}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};
