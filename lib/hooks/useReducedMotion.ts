'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (notify: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
};

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;

const getServerSnapshot = (): boolean => false;

export const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
