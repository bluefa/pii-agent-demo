import { useCallback, useState } from 'react';
import { useModal } from '@/app/hooks/useModal';

export interface ExclusionPopoverState {
  resourceId: string;
  anchor: HTMLElement;
}

interface UseExclusionPickerArgs {
  /** Re-check → back to integration target (clears any exclusion). */
  onSelect: (resourceId: string) => void;
  /** A reason was confirmed → the resource is excluded with it. */
  onExclude: (resourceId: string, reason: string, custom: boolean) => void;
}

/**
 * Exclusion-reason picking workflow (mirror of the IDC flow): unchecking a target
 * opens the preset popover; "사유 직접 입력" hands off to the free-text modal
 * (useModal<string>, data = resourceId). The row stays a target until a reason is
 * confirmed — dismissing either surface changes nothing.
 */
export const useExclusionPicker = ({ onSelect, onExclude }: UseExclusionPickerArgs) => {
  const [popover, setPopover] = useState<ExclusionPopoverState | null>(null);
  const reasonModal = useModal<string>();

  const handleToggleSelected = useCallback(
    (resourceId: string, checked: boolean, anchor: HTMLElement) => {
      if (checked) onSelect(resourceId);
      else setPopover({ resourceId, anchor });
    },
    [onSelect],
  );

  const handleReasonChipClick = useCallback((resourceId: string, anchor: HTMLElement) => {
    setPopover({ resourceId, anchor });
  }, []);

  const handlePickPreset = useCallback(
    (reason: string) => {
      if (!popover) return;
      onExclude(popover.resourceId, reason, false);
      setPopover(null);
    },
    [popover, onExclude],
  );

  const openReasonModal = reasonModal.open;
  const handlePickCustom = useCallback(() => {
    if (!popover) return;
    openReasonModal(popover.resourceId);
    setPopover(null);
  }, [popover, openReasonModal]);

  const closeReasonModal = reasonModal.close;
  const handleSaveReason = useCallback(
    (reason: string) => {
      if (reasonModal.data === undefined) return;
      onExclude(reasonModal.data, reason, true);
      closeReasonModal();
    },
    [reasonModal.data, closeReasonModal, onExclude],
  );

  const dismissPopover = useCallback(() => setPopover(null), []);

  const closeAll = useCallback(() => {
    setPopover(null);
    closeReasonModal();
  }, [closeReasonModal]);

  return {
    popover,
    reasonModal,
    handleToggleSelected,
    handleReasonChipClick,
    handlePickPreset,
    handlePickCustom,
    handleSaveReason,
    dismissPopover,
    closeAll,
  };
};
