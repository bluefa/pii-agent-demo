'use client';

import { statusColors, interactiveColors, cn } from '@/lib/theme';
import {
  StatusErrorIcon,
  StatusInfoIcon,
  StatusSuccessIcon,
  StatusWarningIcon,
} from '@/app/components/ui/icons';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  variant: ToastVariant;
  message: string;
  dismissible: boolean;
  onDismiss: (id: string) => void;
}

const VARIANT_ICON = {
  success: StatusSuccessIcon,
  error: StatusErrorIcon,
  info: StatusInfoIcon,
  warning: StatusWarningIcon,
} as const;

export const Toast = ({ id, variant, message, dismissible, onDismiss }: ToastProps) => {
  const colors = statusColors[variant];
  const Icon = VARIANT_ICON[variant];

  return (
    <li
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-3 min-w-[280px] max-w-sm px-4 py-3 rounded-lg border shadow-sm bg-white',
        colors.border,
        'transition-opacity duration-150'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colors.text)} aria-hidden />
      <p className="flex-1 text-sm text-gray-900 break-words">{message}</p>
      {dismissible && (
        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label="닫기"
          className={cn('p-1 -m-1 rounded transition-colors', interactiveColors.closeButton)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </li>
  );
};
