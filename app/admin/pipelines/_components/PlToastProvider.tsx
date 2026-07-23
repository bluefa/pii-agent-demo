'use client';

/**
 * PlToastProvider — section-level toast root for the pipeline admin pages.
 * Mounted once in app/integration/admin/pipelines/layout.tsx so a toast fired
 * right before router.push (e.g. "설치 작업이 실행됐어요") survives the
 * page unmount — the layout persists across in-section navigations.
 */
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { PlToast } from '@/app/admin/pipelines/_components/PlToast';
import type { PlToastController } from '@/app/admin/pipelines/_components/usePlToast';

export const PlToastContext = createContext<PlToastController | null>(null);

interface ToastState {
  message: string;
  id: number;
}

export function PlToastProvider({
  children,
  durationMs = 2600,
}: {
  children: ReactNode;
  durationMs?: number;
}) {
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

  return (
    <PlToastContext.Provider value={{ message: state?.message ?? null, show, dismiss }}>
      {children}
      <PlToast message={state?.message ?? null} />
    </PlToastContext.Provider>
  );
}
