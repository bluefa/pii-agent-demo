'use client';

/**
 * ModalShell — overlay + centered dialog (design-inventory §Modal). Closes on
 * overlay click, ESC (unless `closeOnEsc={false}` — mouse-only modals), and route
 * change; focuses the first button on open.
 * `variant='task'` = 600px column with a max-height (body scrolls);
 * `variant='wide'` = 720px (start-pipeline modal); `variant='xwide'` = 960px
 * (Custom builder — drag canvas + docked catalog need the room);
 * `variant='app'` = Task Queue app-modal chrome (r20/p0/88vh scroll — width via
 * className, see TqModal). Pair with the app's useModal() hook for open/close
 * state (self-contained cleanup here).
 */
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  variant?: 'default' | 'task' | 'wide' | 'xwide' | 'app';
  children: ReactNode;
  /** id of the heading element that labels the dialog. */
  labelledBy?: string;
  className?: string;
  /** When false, the Escape key does NOT close the dialog (mouse-only: overlay click / close button). Default true. */
  closeOnEsc?: boolean;
}

export function ModalShell({
  open,
  onClose,
  variant = 'default',
  children,
  labelledBy,
  className,
  closeOnEsc = true,
}: ModalShellProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const openedAt = useRef(pathname);

  // ESC closes, unless the caller opted out (mouse-only modal).
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, closeOnEsc]);

  // Focus the first button on open, trap Tab inside, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onTab = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialogRef.current.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      restoreTo?.focus();
    };
  }, [open]);

  // Route change closes (drill-down navigation dismisses the modal).
  useEffect(() => {
    if (open && pathname !== openedAt.current) onClose();
    openedAt.current = pathname;
  }, [pathname, open, onClose]);

  if (!open) return null;
  const { modal } = pipelineStyles;
  return (
    <div
      className={modal.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={
          // 'app' swaps the whole dialog chrome (r20/p0/scroll) — the others
          // layer a width onto the shared `dialog` base.
          variant === 'app'
            ? cn(modal.dialogApp, className)
            : cn(
                modal.dialog,
                variant === 'task'
                  ? modal.dialogTask
                  : variant === 'wide'
                    ? modal.dialogWide
                    : variant === 'xwide'
                      ? modal.dialogXWide
                      : modal.dialogDefault,
                className,
              )
        }
      >
        {children}
      </div>
    </div>
  );
}
