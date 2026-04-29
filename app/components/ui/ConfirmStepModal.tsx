'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { cn, confirmModalStyles, modalStyles, textColors } from '@/lib/theme';

type IconVariant = 'warn' | 'danger';
type ConfirmVariant = 'warn' | 'danger';

export interface ConfirmStepModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  note?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  isPending?: boolean;
  iconVariant?: IconVariant;
}

export const ConfirmStepModal = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  note,
  confirmLabel,
  cancelLabel = '머무르기',
  confirmVariant = 'warn',
  isPending = false,
  iconVariant = 'warn',
}: ConfirmStepModalProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusables = [cancelRef.current, confirmRef.current].filter(
          (node): node is HTMLButtonElement => node !== null,
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, isPending]);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [open]);

  if (!open) return null;

  const handleBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPending && event.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className={modalStyles.overlay}
      onClick={handleBackdrop}
      data-testid="confirm-step-modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-step-modal-title"
        aria-describedby="confirm-step-modal-desc"
        className="bg-white rounded-xl shadow-xl w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden"
      >
        <div className="flex items-start gap-3.5 px-7 pt-7 pb-3">
          <div
            className={cn(
              'flex-shrink-0 w-[38px] h-[38px] rounded-full flex items-center justify-center',
              confirmModalStyles.iconCircle[iconVariant],
            )}
          >
            <StatusWarningIcon className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="confirm-step-modal-title"
              className={cn('text-base font-semibold mb-1.5', textColors.primary)}
            >
              {title}
            </h2>
            <p
              id="confirm-step-modal-desc"
              className={cn('text-[13px] leading-[1.55]', textColors.tertiary)}
            >
              {description}
            </p>
          </div>
        </div>

        {note && (
          <div className="px-7 pb-1">
            <div
              className={cn(
                'rounded-lg border px-3 py-2.5 text-[12px] leading-[1.55]',
                confirmModalStyles.note.warning,
              )}
            >
              {note}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 px-7 pt-4 pb-7">
          <button
            ref={cancelRef}
            type="button"
            className={confirmModalStyles.outlineButton}
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={
              confirmVariant === 'danger'
                ? confirmModalStyles.dangerOutlineButton
                : confirmModalStyles.outlineButton
            }
            onClick={onConfirm}
            disabled={isPending}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
