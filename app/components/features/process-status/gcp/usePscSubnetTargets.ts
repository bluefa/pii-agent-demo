'use client';

import { useEffect, useMemo, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';
import {
  pscSubnetTargets,
  type PscSubnetTarget,
} from '@/app/components/features/process-status/gcp/psc-subnet';

/**
 * The PSC proxy subnets a GCP target's service side has to create, read off the
 * confirmed rows (ResourceConfigDto.host_project / host_network, top level). Until
 * 2026-09-16 this read the approved rows' metadata instead; BE moved the facts here.
 *
 * Shared by the user's step-4 card and the admin 인프라 작업 head, so both draw the
 * same commands from the same rows. `enabled: false` (a non-GCP target) fetches
 * nothing and returns an empty list. A failed read also returns empty: the guide is
 * reference, and the step still stands on its own description.
 *
 * `pending` (from `pendingSubnetResourceIds`) keeps only the Regions still to make.
 */
export const usePscSubnetTargets = (
  targetSourceId: number,
  enabled = true,
  pending?: ReadonlySet<string>,
): PscSubnetTarget[] => {
  const [rows, setRows] = useState<ConfirmedIntegrationResourceInfo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((r) => setRows(r.resource_infos ?? []))
      .catch(() => setRows([]));
    return () => controller.abort();
  }, [targetSourceId, enabled]);
  return useMemo(() => pscSubnetTargets(rows, pending), [rows, pending]);
};
