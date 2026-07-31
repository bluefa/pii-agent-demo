'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn, modalStyles } from '@/lib/theme';

export interface ConfirmStepModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isPending?: boolean;
}

/** Tighter chrome than modalStyles.toss.* (px-10/pt-9, no footer hairline change): a two-button
 *  confirm is a compact dialog, and the full approval-modal padding left its short content
 *  floating in air. The footer also drops the top hairline — short enough that a divider reads
 *  as cutting the dialog in half. The taller approval modals keep the shared tokens. */
const confirmHeader = 'px-6 pt-6 pb-1.5 flex items-start justify-between';
const confirmFooter = 'px-6 pt-5 pb-6 bg-white flex justify-end gap-2.5';

/** Footer pair on the in-card `.btn` scale (h40 / radius12 / 14px) — the 52px modalBtn tier
 *  belongs to the tall approval modals and overwhelmed a two-line dialog. */
const confirmCancelBtn =
  'inline-flex h-10 items-center justify-center rounded-[12px] bg-[#F7F8FA] px-5 text-[14px] font-semibold text-[#191F28] transition-colors hover:bg-[#EBEEF2] disabled:cursor-not-allowed disabled:opacity-60';
const confirmPrimaryBtn =
  'inline-flex h-10 items-center justify-center rounded-[12px] bg-[#0064FF] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0050D6] disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]';

export const ConfirmStepModal = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = '머무르기',
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

        <div className={confirmFooter}>
          <button
            ref={cancelRef}
            type="button"
            className={confirmCancelBtn}
            onClick={onClose}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={confirmPrimaryBtn}
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
