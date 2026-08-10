'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ReloadIcon } from '@/app/components/ui/icons';
import { cn, modalStyles, scanTransition, statusColors } from '@/lib/theme';

/**
 * What the request ended as. Set it and the dialog swaps its body for the result
 * frame — same card, same box, only the contents change (the rule `ScanRunningState`
 * follows for the same reason: a card that resizes at the moment of the result makes
 * the jump the first thing read).
 */
export interface ConfirmStepResult {
  kind: 'success' | 'error';
  title: string;
  description: string;
  /** One-line failure detail — only when the server said something a user can act on. */
  reason?: string;
}

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
  /**
   * Present = the request is over; the result frame replaces the body and the footer pair.
   * `success` also locks every close path: the step transition is already committed, so a
   * cancel during that hold would dismiss the dialog and still land on the next step.
   */
  result?: ConfirmStepResult | null;
  /** 다시 요청하기 on the error frame. Without it the frame shows 닫기 alone. */
  onRetry?: () => void;
}

/** Tighter chrome than modalStyles.toss.* (px-10/pt-9, no footer hairline change): a two-button
 *  confirm is a compact dialog, and the full approval-modal padding left its short content
 *  floating in air. The footer also drops the top hairline — short enough that a divider reads
 *  as cutting the dialog in half. The taller approval modals keep the shared tokens.
 *  It carries no background either: the card is already white, and an opaque footer painted
 *  over the shadow of whatever the body ends with (the approval stat tiles), chopping it into
 *  a hard full-width edge — the very divider this footer set out not to draw. */
const confirmHeader = 'px-6 pt-6 pb-1.5 flex items-start justify-between';
const confirmFooter = 'px-6 pt-5 pb-6 flex justify-end gap-2.5';

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

/** Result frame — one centred column in the space the body and footer had. */
const resultFrame = 'flex flex-1 flex-col items-center justify-center px-10 py-10 text-center';
const resultTile = 'mb-5 grid h-16 w-16 place-items-center rounded-2xl';
const resultTitle = 'text-[20px] font-bold tracking-[-0.02em] leading-[1.3] text-[#191F28]';
/** Same quiet tier as `modalStyles.toss.subtitle`, one step down in size — the frame is short. */
const resultDesc = 'mt-2 text-[13.5px] font-medium leading-[1.6] text-[#6B7280]';
/** Reason line — the `.req-modal` warn box's exact values (idcStyles.reqModal.warn), copied
 *  rather than imported so a shared dialog carries no provider-namespaced token. */
const resultReason =
  'mt-3.5 max-w-[420px] rounded-[10px] border border-[#F8D2D0] bg-[#FEF1F1] px-3.5 py-[11px] text-[12.5px] leading-[1.5] text-[#B42318]';

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
  result = null,
  onRetry,
}: ConfirmStepModalProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resultKind = result?.kind ?? null;
  const locked = isPending || resultKind === 'success';

  useEffect(() => {
    // Pin the height the card has while it is still the confirm, so the result frame
    // lands in the same box — a card that resizes at the moment of the result makes the
    // jump the first thing read. Written to the node rather than kept in state: it is a
    // measurement of the DOM, and re-rendering to feed it back would be a round trip for
    // a value that never changes what React draws. min-height only, so a longer result
    // (a server reason spanning two lines) can still grow.
    const card = dialogRef.current;
    if (open && !result && card) card.style.minHeight = `${card.offsetHeight}px`;
  }, [open, result]);

  useEffect(() => {
    // The error frame's own commit button takes focus — the elements that had it are gone.
    if (resultKind === 'error') retryRef.current?.focus();
  }, [resultKind]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) {
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
  }, [open, onClose, locked]);

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
    if (!locked && event.target === overlayRef.current) {
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
          'max-w-[calc(100vw-2rem)] flex flex-col',
        )}
      >
        {result ? (
          <div
            className={resultFrame}
            // The frame IS the announcement — it replaces the dialog that was read on open,
            // and a failure has to interrupt (assertive) or the user keeps waiting on a
            // transition that already stopped.
            role={result.kind === 'error' ? 'alert' : 'status'}
            aria-live={result.kind === 'error' ? 'assertive' : 'polite'}
          >
            <div
              className={cn(
                resultTile,
                result.kind === 'success'
                  ? cn(statusColors.success.bg, statusColors.success.text)
                  : cn(statusColors.error.bg, statusColors.error.text),
              )}
            >
              {result.kind === 'success' ? (
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {/* Same check as the scan completion frame: dasharray only, offset left at
                      its default, so motion-reduce drops the draw and keeps the mark. */}
                  <path d="M4.5 12.5l5 5 10-11" strokeDasharray={30} className={scanTransition.checkDraw} />
                </svg>
              ) : (
                <svg
                  className="h-[30px] w-[30px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12.5" />
                  <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
                </svg>
              )}
            </div>
            <h2 id="confirm-step-modal-title" className={resultTitle}>
              {result.title}
            </h2>
            <p id="confirm-step-modal-desc" className={resultDesc}>
              {result.description}
            </p>
            {result.reason && <p className={resultReason}>{result.reason}</p>}
            {result.kind === 'error' && (
              <div className="mt-6 flex gap-2.5">
                <button type="button" className={confirmCancelBtn} onClick={onClose}>
                  닫기
                </button>
                {onRetry && (
                  <button ref={retryRef} type="button" className={confirmPrimaryBtn} onClick={onRetry}>
                    <ReloadIcon className="h-[15px] w-[15px]" />
                    다시 요청하기
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};
