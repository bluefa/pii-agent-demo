'use client';

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, textColors } from '@/lib/theme';

interface ServiceMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceCode: string;
  serviceName: string;
}

export const ServiceMoveConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  serviceCode,
  serviceName,
}: ServiceMoveConfirmModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="서비스 이동 확인"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onConfirm}>이동</Button>
        </>
      }
    >
      <p className={cn('text-sm', textColors.secondary)}>
        {serviceCode} {serviceName} 서비스 관리 페이지로 이동하시겠습니까?
      </p>
    </Modal>
  );
};
