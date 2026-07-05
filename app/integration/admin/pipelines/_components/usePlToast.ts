'use client';

/**
 * usePlToast — minimal bottom-center toast state for the pipeline pages.
 * The app's generic `@/app/components/ui/toast` has different chrome; the design
 * mandates a specific gray-900 / i-check / 2600ms toast, so this is bespoke.
 * Pair with <PlToast message={toast.message} />.
 */
import { useCallback, useEffect, useState } from 'react';

export interface PlToastController {
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
}

interface ToastState {
  message: string;
  /** Bumped every show() so re-showing the same text restarts the timer. */
  id: number;
}

export function usePlToast(durationMs = 2600): PlToastController {
  const [state, setState] = useState<ToastState | null>(null);

  const show = useCallback((message: string) => {
    setState({ message, id: Date.now() });
  }, []);

  const dismiss = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const timer = window.setTimeout(() => setState(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [state, durationMs]);

  return { message: state?.message ?? null, show, dismiss };
}
