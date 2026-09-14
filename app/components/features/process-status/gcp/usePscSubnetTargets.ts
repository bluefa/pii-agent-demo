'use client';

import { useEffect, useMemo, useState } from 'react';
import { getApprovedIntegration } from '@/app/lib/api';
import type { ResourceSnapshot } from '@/lib/types';
import {
  pscSubnetTargets,
  type PscSubnetTarget,
} from '@/app/components/features/process-status/gcp/psc-subnet';

/**
 * The PSC proxy subnets a GCP target's service side has to create, read off the
 * approved rows — the one DTO that carries host_project / host_network
 * (TargetSourceResourceMetadataDto); confirmed-integration has neither.
 *
 * Shared by the user's step-4 card and the admin 인프라 작업 head, so both draw the
 * same commands from the same rows. `enabled: false` (a non-GCP target) fetches
 * nothing and returns an empty list. A failed read also returns empty: the guide is
 * reference, and the step still stands on its own description.
 */
export const usePscSubnetTargets = (targetSourceId: number, enabled = true): PscSubnetTarget[] => {
  const [rows, setRows] = useState<ResourceSnapshot[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getApprovedIntegration(targetSourceId, { signal: controller.signal })
      .then((r) => setRows(r.approved_integration?.resource_infos ?? []))
      .catch(() => setRows([]));
    return () => controller.abort();
  }, [targetSourceId, enabled]);
  return useMemo(() => pscSubnetTargets(rows), [rows]);
};
