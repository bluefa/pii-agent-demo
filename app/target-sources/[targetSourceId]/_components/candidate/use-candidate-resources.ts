import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getConfirmResources } from '@/app/lib/api';
import { catalogToCandidates } from '@/lib/resource-catalog';
import { AppError } from '@/lib/errors';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import type { CandidateResource } from '@/lib/types/resources';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import { getCandidateErrorMessage } from '@/app/target-sources/[targetSourceId]/_components/candidate/errors';
import {
  fetchResourcesWithRetry,
  isTransientError,
} from '@/app/target-sources/[targetSourceId]/_components/candidate/load-resources';

/** Per-resource exclusion reason (mirror of the IDC flow). */
export interface Exclusion {
  reason: string;
  /** True when entered via the free-text modal (vs a preset) — drives the popover highlight. */
  custom: boolean;
}

const EMPTY_CANDIDATES: CandidateResource[] = [];

// Right after a scan the resource list can momentarily read empty or error while the
// backend finishes materializing it — retry a few times before settling into the
// empty/error state. A plain load does a single attempt (empty is a valid rest state).
const MAX_RESOURCE_ATTEMPTS = 4; // 1 initial + 3 retries
const RESOURCE_RETRY_DELAY_MS = 800;

/**
 * Owns the Step-1 resource list: fetch (+post-scan retry) and the selection /
 * exclusion state seeded from the response's `selected` / `exclusion_reason`.
 */
export const useCandidateResources = (targetSourceId: number) => {
  const [state, setState] = useState<AsyncState<CandidateResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exclusions, setExclusions] = useState<Record<string, Exclusion>>({});
  // Set by the scan-complete path so the next fetch retries on empty/error.
  const retryAfterScanRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const maxAttempts = retryAfterScanRef.current ? MAX_RESOURCE_ATTEMPTS : 1;
    retryAfterScanRef.current = false;

    const delayBeforeRetry = () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, RESOURCE_RETRY_DELAY_MS);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

    void fetchResourcesWithRetry(
      () =>
        getConfirmResources(targetSourceId, { signal: controller.signal }).then((response) =>
          catalogToCandidates(response.resources),
        ),
      maxAttempts,
      delayBeforeRetry,
      isTransientError,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', data });
        // Seed selection from the backend's `selected` flag (never for ineligible
        // rows, whose checkbox is disabled), and seed any exclusion reasons it sent.
        setSelectedIds(new Set(
          data.filter((c) => c.selected && c.integrationCategory !== 'INSTALL_INELIGIBLE').map((c) => c.id),
        ));
        const seeded: Record<string, Exclusion> = {};
        for (const candidate of data) {
          const reason = candidate.exclusionReason;
          if (!candidate.selected && reason) {
            seeded[candidate.id] = {
              reason,
              custom: !IDC_EXCL_PRESETS.some((preset) => preset === reason),
            };
          }
        }
        setExclusions(seeded);
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: getCandidateErrorMessage(error) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const candidates = useMemo(
    () => (state.status === 'ready' ? state.data : EMPTY_CANDIDATES),
    [state],
  );

  const refetch = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  // Fresh scan → clear working selection; the refetch re-seeds it from the new
  // results and retries on a momentarily empty/error response.
  const refetchAfterScan = useCallback(() => {
    setSelectedIds(new Set());
    setExclusions({});
    retryAfterScanRef.current = true;
    refetch();
  }, [refetch]);

  return {
    state,
    candidates,
    selectedIds,
    setSelectedIds,
    exclusions,
    setExclusions,
    refetch,
    refetchAfterScan,
  };
};
