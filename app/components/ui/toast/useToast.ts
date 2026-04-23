'use client';

import { useMemo } from 'react';
import { useToastContext, type ToastOptions } from './ToastProvider';

export interface UseToastReturn {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const useToast = (): UseToastReturn => {
  const { show, dismiss } = useToastContext();
  return useMemo(
    () => ({
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
      info: (message, options) => show('info', message, options),
      warning: (message, options) => show('warning', message, options),
      dismiss,
    }),
    [show, dismiss]
  );
};

