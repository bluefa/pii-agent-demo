'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn, idcStyles, modalStyles } from '@/lib/theme';

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
}

/** v16 destructive-confirm chrome (`.adm-banner.amber` warn + red `.btn.primary`). */
const dangerConfirmButton =
  'inline-flex h-[52px] items-center justify-center rounded-[14px] bg-[#DC2626] px-7 text-[15px] font-bold tracking-[-0.01em] text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]';

const warnBanner =
  'rounded-[12px] bg-[#FEF3C7] px-4 py-[13px] text-[13px] leading-[1.55] tracking-[-0.01em] text-[#92400E]';

/** Tighter chrome than modalStyles.toss.* (px-10/pt-9, no footer hairline change): a two-button
 *  confirm is a compact dialog, and the full approval-modal padding left its short content
 *  floating in air. The footer also drops the top hairline — short enough that a divider reads
 *  as cutting the dialog in half. The taller approval modals keep the shared tokens. */
const confirmHeader = 'px-6 pt-6 pb-1.5 flex items-start justify-between';
const confirmBody = 'px-6 pt-5 pb-2';
const confirmFooter = 'px-6 pt-5 pb-6 bg-white flex justify-end gap-2.5';

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
        className={cn(
          modalStyles.container,
          modalStyles.toss.container,
          'w-[480px] max-w-[calc(100vw-2rem)]',
        )}
      >
        <div className={confirmHeader}>
          <div>
            <h2 id="confirm-step-modal-title" className={modalStyles.toss.title}>
              {title}
            </h2>
            <p
              id="confirm-step-modal-desc"
              className={modalStyles.toss.subtitle}
            >
              {description}
            </p>
          </div>
        </div>

        {note && (
          <div className={confirmBody}>
            <div className={warnBanner}>{note}</div>
          </div>
        )}

        <div className={confirmFooter}>
          <button
            ref={cancelRef}
            type="button"
            className={idcStyles.modalBtn.gray}
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
                ? dangerConfirmButton
                : idcStyles.modalBtn.primary
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
