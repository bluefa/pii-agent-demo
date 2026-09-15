/**
 * Who a resource id IS — the confirmed-integration row behind an id, for the 설치 상태
 * card's open-resource table.
 *
 * installation-status identifies a resource by `resource_id` only. Cloud wires also
 * carry a `resource_name`; the IDC wire does not — an IDC row is its endpoint
 * (design-spec §8), and that endpoint lives in the confirmed integration the 확정 정보
 * tab already reads. The table draws those rows with the IDC resource table's own cells,
 * so this hands back the same row shape that table takes (`confirmedToIdcRows`).
 *
 * Best effort. A failed read leaves the map empty and the rows fall back to the wire
 * id — the verdict and the counts never depend on it.
 */
import { useEffect, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';

export type InstallResourceIdentity = ReadonlyMap<string, RequestResourceRow>;

const EMPTY: InstallResourceIdentity = new Map();

export function useInstallResourceIdentity(targetSourceId: number, enabled: boolean): InstallResourceIdentity {
  // Keyed by target so a stale read never labels another target's rows.
  const [loaded, setLoaded] = useState<{ id: number; map: InstallResourceIdentity } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((data) =>
        setLoaded({
          id: targetSourceId,
          map: new Map(
            confirmedToIdcRows(data.resource_infos ?? []).flatMap((row) =>
              row.resourceId ? [[row.resourceId, row] as const] : [],
            ),
          ),
        }),
      )
      .catch(() => {
        // Not confirmed yet (404), aborted, or down: the rows print the wire id.
      });
    return () => controller.abort();
  }, [targetSourceId, enabled]);
  return loaded?.id === targetSourceId ? loaded.map : EMPTY;
}
