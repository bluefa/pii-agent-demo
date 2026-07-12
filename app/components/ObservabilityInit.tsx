'use client';

import { useEffect } from 'react';
import { installGlobalErrorHandlers } from '@/lib/client-error-report';

/**
 * Mounts once in the root layout. Installs the global `error` /
 * `unhandledrejection` handlers on the client; renders nothing.
 */
export function ObservabilityInit(): null {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}
