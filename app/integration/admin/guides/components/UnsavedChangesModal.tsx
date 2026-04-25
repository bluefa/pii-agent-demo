'use client';

/**
 * Guide CMS — dirty navigation confirm modal.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W3-b-editor.md §Step 5 +
 * design/guide-cms/interactions.md §Confirm Modal.
 *
 * Project `Modal` API: `isOpen` (NOT `open`). Project `Button` only
 * supports `primary | secondary | danger` variants — `outline`,
 * `destructive`, and `autoFocus` props do not exist. Spec defers the
 * "secondary autoFocus" polish to a later wave.
 */

import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { cn, textColors } from '@/lib/theme';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal = ({ isOpen, onConfirm, onCancel }: UnsavedChangesModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title="저장되지 않은 변경사항"
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel}>취소</Button>
        <Button variant="danger" onClick={onConfirm}>변경 폐기 후 이동</Button>
      </>
    }
  >
    <p className={cn('text-sm', textColors.secondary)}>
      현재 편집 중인 내용이 저장되지 않았습니다. 이동하시겠습니까?
    </p>
  </Modal>
);
