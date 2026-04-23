'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TIMINGS } from '@/lib/constants/timings';
import { ToastContainer, type ToastItem } from './ToastContainer';
import type { ToastVariant } from './Toast';

const MAX_VISIBLE = 3;
const ERROR_DURATION_MULTIPLIER = 1.5;

export interface ToastOptions {
  durationMs?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  show: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToastContext = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>');
  }
  return ctx;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer]
  );

  const show = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions): string => {
      const id = crypto.randomUUID();
      const dismissible = options?.dismissible ?? true;
      const baseDuration = options?.durationMs ?? TIMINGS.TOAST_HIDE_MS;
      const duration = variant === 'error' ? baseDuration * ERROR_DURATION_MULTIPLIER : baseDuration;

      setToasts((prev) => {
        const next = [{ id, variant, message, dismissible }, ...prev];
        const overflow = next.slice(MAX_VISIBLE);
        overflow.forEach((t) => clearTimer(t.id));
        return next.slice(0, MAX_VISIBLE);
      });

      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [dismiss, clearTimer]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};
