'use client';

import { useEffect, useRef, useState } from 'react';
import { AppError } from '@/lib/errors';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';

/**
 * Discriminated state for an IDC "read resources" fetch (ADR-017 §5 fetch-high).
 * Canonical shape extracted from the per-step copies in IDC Steps 2/3/6/7.
 */
export type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

/**
 * Shared "read resources" fetch for read-only IDC steps (2/3/6/7).
 *
 * Preserves the exact per-step behavior the steps duplicated (idc-v15 §DR):
 *   - initial `loading` state,
 *   - AbortController cancels the in-flight request on switch/unmount (DR3),
 *   - an `AppError` with code `ABORTED` is swallowed (DR3),
 *   - a late response whose requested id ≠ the current id is discarded (DR5),
 *   - any other failure resolves to `error`.
 */
export function useIdcResources(targetSourceId: number): { state: ResourcesState } {
  const [state, setState] = useState<ResourcesState>({ status: 'loading' });

  const currentIdRef = useRef(targetSourceId);

  useEffect(() => {
    currentIdRef.current = targetSourceId; // set in-effect, not in render (react-hooks/refs)
    const controller = new AbortController();
    const requestedId = targetSourceId;

    void getIdcResources(targetSourceId, { signal: controller.signal })
      .then((resources) => {
        if (controller.signal.aborted || requestedId !== currentIdRef.current) return; // DR3/DR5
        setState({ status: 'ready', resources });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error) || requestedId !== currentIdRef.current) {
          return; // DR3/DR5
        }
        setState({ status: 'error' });
      });

    return () => controller.abort(); // DR3
  }, [targetSourceId]);

  return { state };
}
