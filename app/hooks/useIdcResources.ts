'use client';

import { useEffect, useState } from 'react';
import { AppError } from '@/lib/errors';
import type { IdcResourceView } from '@/app/lib/api/idc';

/**
 * Discriminated state for an IDC "read resources" fetch (ADR-017 §5 fetch-high).
 * Canonical shape extracted from the per-step copies in IDC Steps 2/3/6/7.
 */
export type ResourcesState =
  | { status: 'loading' }
  | { status: 'ready'; resources: IdcResourceView[] }
  | { status: 'error' };

/** A per-step resource source (AbortSignal-aware GET → domain views). */
export type IdcResourceSource = (
  targetSourceId: number,
  opts?: { signal?: AbortSignal },
) => Promise<IdcResourceView[]>;

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

/**
 * Shared "read resources" fetch for read-only IDC steps (2/3/6/7).
 *
 * The read SOURCE differs per step (the list each step shows is a different
 * lifecycle stage), so the caller passes it in:
 *   - Step 2 (승인 대기)  → getIdcApprovalRequestResources (approval-requests/latest)
 *   - Step 3 (반영중)     → getIdcApprovedResources       (approved-integration)
 *   - Step 6/7           → getIdcConfirmedResources       (confirmed-integration)
 * (Step 1's load-prior modal keeps previous-request; Step 4 reads installation-status.)
 *
 * Behavior (idc-v15 §DR):
 *   - initial `loading` state,
 *   - the AbortController cancels the in-flight request on targetSourceId change /
 *     unmount; a late resolution is discarded via `controller.signal.aborted` (DR3),
 *   - an `AppError` with code `ABORTED` is swallowed (DR3),
 *   - any other failure resolves to `error`.
 *
 * It does NOT reset to `loading` when `targetSourceId` changes: the IDC subtree is
 * keyed by targetSourceId (DR2 remount), so the hook remounts fresh per target. A
 * caller that reuses it without that key must key the subtree itself. The `source`
 * is expected to be a stable module-level function (it is read fresh each effect).
 */
export function useIdcResources(
  targetSourceId: number,
  source: IdcResourceSource,
): { state: ResourcesState } {
  const [state, setState] = useState<ResourcesState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void source(targetSourceId, { signal: controller.signal })
      .then((resources) => {
        if (controller.signal.aborted) return; // cleanup aborted this request (DR3)
        setState({ status: 'ready', resources });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return; // DR3
        setState({ status: 'error' });
      });

    return () => controller.abort(); // DR3
    // `source` is a stable module-level fn (per-step); targetSourceId drives refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSourceId]);

  return { state };
}
