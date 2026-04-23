'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Toast, type ToastVariant } from './Toast';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  dismissible: boolean;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) return null;

  return createPortal(
    <ul
      aria-label="알림"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none [&>li]:pointer-events-auto"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          variant={toast.variant}
          message={toast.message}
          dismissible={toast.dismissible}
          onDismiss={onDismiss}
        />
      ))}
    </ul>,
    document.body
  );
};
