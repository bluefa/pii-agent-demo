'use client';

/**
 * ModalShell — overlay + centered dialog (design-inventory §Modal). Closes on
 * overlay click, ESC, and route change; focuses the first button on open.
 * `variant='task'` = 600px column with a max-height (body scrolls). Pair with
 * the app's useModal() hook for open/close state (self-contained cleanup here).
 */
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  variant?: 'default' | 'task';
  children: ReactNode;
  /** id of the heading element that labels the dialog. */
  labelledBy?: string;
  className?: string;
}

export function ModalShell({
  open,
  onClose,
  variant = 'default',
  children,
  labelledBy,
  className,
}: ModalShellProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const openedAt = useRef(pathname);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus the first button when opened.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
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
        className={cn(modal.dialog, variant === 'task' ? modal.dialogTask : modal.dialogDefault, className)}
      >
        {children}
      </div>
    </div>
  );
}
