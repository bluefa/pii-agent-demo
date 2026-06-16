'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from '@/lib/errors';
import { ERROR_MESSAGES } from '@/lib/constants/messages';
import {
  checkIdcInstallation,
  getIdcInstallationStatus,
  type IdcInstallationView,
} from '@/app/lib/api/idc';

export interface UseIdcInstallationStatusResult {
  status: IdcInstallationView | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Force-refresh via check-installation (DR5-guarded). */
  refresh: () => Promise<void>;
}

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';
const toMessage = (err: unknown): string =>
  err instanceof Error ? err.message : ERROR_MESSAGES.STATUS_FETCH_FAILED;

/**
 * IDC installation status with target-switch safety (docs/reports/idc-v15 §DR):
 *   DR3 — AbortController cancels the in-flight request on switch/unmount.
 *   DR4 — status is cleared the moment targetSourceId changes (no stale flash).
 *   DR5 — a late response whose id ≠ the current id is discarded.
 */
export function useIdcInstallationStatus(targetSourceId: number): UseIdcInstallationStatusResult {
  const [status, setStatus] = useState<IdcInstallationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdRef = useRef(targetSourceId);
  currentIdRef.current = targetSourceId;

  useEffect(() => {
    const controller = new AbortController();
    const requestedId = targetSourceId;
    setLoading(true);
    setStatus(null); // DR4
    setError(null);

    getIdcInstallationStatus(targetSourceId, { signal: controller.signal })
      .then((data) => {
        if (requestedId !== currentIdRef.current) return; // DR5
        setStatus(data);
      })
      .catch((err) => {
        if (isAbort(err) || requestedId !== currentIdRef.current) return; // DR3/DR5
        setError(toMessage(err));
      })
      .finally(() => {
        if (requestedId === currentIdRef.current) setLoading(false);
      });

    return () => controller.abort(); // DR3
  }, [targetSourceId]);

  const refresh = useCallback(async () => {
    const requestedId = targetSourceId;
    setRefreshing(true);
    setError(null);
    try {
      const data = await checkIdcInstallation(targetSourceId);
      if (requestedId === currentIdRef.current) setStatus(data); // DR5
    } catch (err) {
      if (!isAbort(err) && requestedId === currentIdRef.current) setError(toMessage(err));
    } finally {
      if (requestedId === currentIdRef.current) setRefreshing(false);
    }
  }, [targetSourceId]);

  return { status, loading, refreshing, error, refresh };
}
