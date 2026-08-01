'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
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
  /**
   * Optional body between the description and the footer (e.g. the approval
   * submit stats). Text-only confirms omit it and keep the compact two-line shape.
   */
  children?: ReactNode;
  /** 560px instead of 480px — for confirms that carry a body block. */
  wide?: boolean;
  /** Gates the confirm button beyond isPending (e.g. required input still empty). */
  confirmDisabled?: boolean;
  /** Where focus lands on open — input-carrying confirms point at their field; default is 취소. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /**
   * `warning` for confirms that undo work already done (the step rewinds): the confirm
   * button switches to the amber fill so the commit itself carries the caution, instead of
   * a blue CTA that looks like the ordinary way forward. Still exactly one filled button —
   * the tone changes, the hierarchy does not.
   */
  tone?: 'default' | 'warning';
}

/** Tighter chrome than modalStyles.toss.* (px-10/pt-9, no footer hairline change): a two-button
 *  confirm is a compact dialog, and the full approval-modal padding left its short content
 *  floating in air. The footer also drops the top hairline — short enough that a divider reads
 *  as cutting the dialog in half. The taller approval modals keep the shared tokens. */
const confirmHeader = 'px-6 pt-6 pb-1.5 flex items-start justify-between';
const confirmFooter = 'px-6 pt-5 pb-6 bg-white flex justify-end gap-2.5';

/** Footer pair on the in-card `.btn` scale (h40 / radius12 / 14px) — the 52px modalBtn tier
 *  belongs to the tall approval modals and overwhelmed a two-line dialog.
 *  focus-visible = the app's #0064FF halo, offset so it reads on the blue fill too;
 *  keyboard focus gets the branded ring, mouse clicks stay ring-free. */
const confirmFocusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0064FF] focus-visible:ring-offset-2';
const confirmCancelBtn = cn(
  'inline-flex h-10 items-center justify-center rounded-[12px] bg-[#F7F8FA] px-5 text-[14px] font-semibold text-[#191F28] transition-colors hover:bg-[#EBEEF2] disabled:cursor-not-allowed disabled:opacity-60',
  confirmFocusRing,
);
const confirmBtnBase =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-[#EBEEF2] disabled:text-[#8B95A1]';
const confirmPrimaryBtn = cn(
  confirmBtnBase,
  'bg-[#0064FF] hover:bg-[#0050D6]',
  confirmFocusRing,
);
/** amber-700 fill — 4.72:1 against white text, carrying the same weight as the blue CTA it
 *  replaces, so the dialog keeps one filled commit button and only its tone changes. */
const confirmWarningBtn = cn(
  confirmBtnBase,
  'bg-[#B45309] hover:bg-[#92400E]',
  confirmFocusRing,
);

export const ConfirmStepModal = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = '머무르기',
  isPending = false,
  children,
  wide = false,
  confirmDisabled = false,
  initialFocus,
  tone = 'default',
}: ConfirmStepModalProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        // Trap over everything focusable in the dialog, not just the footer pair —
        // input-carrying confirms (e.g. the exclusion-reason textarea) must stay
        // inside the Tab cycle or the wrap skips them permanently.
        const focusables = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), textarea, input, select, a[href]',
          ) ?? [],
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
      // WCAG dialog pattern: closing must hand focus back to the element that
      // opened the dialog. A detached trigger (e.g. the step transitioned away
      // after a successful confirm) makes .focus() a harmless no-op.
      const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      (initialFocus?.current ?? cancelRef.current)?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
        trigger?.focus();
      };
    }
  }, [open, initialFocus]);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-step-modal-title"
        aria-describedby="confirm-step-modal-desc"
        className={cn(
          modalStyles.container,
          modalStyles.toss.container,
          wide ? 'w-[560px]' : 'w-[480px]',
          'max-w-[calc(100vw-2rem)]',
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

        {children && <div className="px-6 pt-4">{children}</div>}

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
            className={tone === 'warning' ? confirmWarningBtn : confirmPrimaryBtn}
            onClick={onConfirm}
            disabled={isPending || confirmDisabled}
          >
            {/* In-flight feedback beyond the disabled tint — the label stays, the
                spinner says "working" (currentColor follows the disabled text). */}
            {isPending && <LoadingSpinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
