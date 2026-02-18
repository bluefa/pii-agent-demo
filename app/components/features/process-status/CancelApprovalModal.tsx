'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { cancelApprovalRequest } from '@/app/lib/api';
import { cn, statusColors, getButtonClass } from '@/lib/theme';

interface CancelApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSourceId: number;
  onCancelSuccess: () => void;
}

export const CancelApprovalModal = ({
  isOpen,
  onClose,
  targetSourceId,
  onCancelSuccess,
}: CancelApprovalModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      await cancelApprovalRequest(targetSourceId);
      onClose();
      onCancelSuccess();
    } catch {
      setError('승인 요청 취소에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="승인 요청 취소"
      size="sm"
      icon={
        <svg className={cn('w-5 h-5', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      footer={
        <>
          <button onClick={onClose} disabled={loading} className={getButtonClass('secondary')}>
            닫기
          </button>
          <button onClick={handleCancel} disabled={loading} className={getButtonClass('danger')}>
            {loading ? '취소 중...' : '요청 취소'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-gray-700">승인 요청을 취소하시겠습니까?</p>
        <p className="text-sm text-gray-500">
          취소 후 리소스를 다시 선택하여 재요청할 수 있습니다.
        </p>
        {error && (
          <p className={cn('text-sm', statusColors.error.text)}>{error}</p>
        )}
      </div>
    </Modal>
  );
};
