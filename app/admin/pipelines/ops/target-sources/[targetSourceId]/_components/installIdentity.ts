/**
 * Who a resource id IS — the label the 설치 상태 rows print for a resource that is
 * still open on a step.
 *
 * installation-status identifies a resource by `resource_id` only. Cloud wires also
 * carry a `resource_name`; the IDC wire does not — an IDC row is its endpoint
 * (design-spec §8), and that endpoint lives in the confirmed integration the 확정 정보
 * tab already reads (`confirmedIdcRows.ts` uses the same address rule). So this joins
 * the two responses by id: name when the CSP has one, else `host:port`, else the id.
 *
 * Best effort. A failed read leaves the map empty and the rows fall back to the wire
 * id — the verdict and the counts never depend on it.
 */
import { useEffect, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

export interface InstallResourceIdentity {
  label: string;
  databaseType: string | null;
  /** BDC측 출발지 — the PII-Agent addresses the firewall has to admit (IDC only, else empty). */
  sourceIps: string[];
}

const strings = (values: ReadonlyArray<string | null | undefined> | null | undefined): string[] =>
  (values ?? []).filter((value): value is string => value != null && value !== '');

/** The same address rule as the 확정 정보 IDC table: IP mode → ips, HOST mode → host, else `host`. */
export function installResourceIdentity(row: ConfirmedIntegrationResourceInfo): InstallResourceIdentity {
  const format = row.idc_host_format ?? null;
  const hosts =
    format === 'IP'
      ? strings(row.idc_ips)
      : format === 'HOST'
        ? strings([row.idc_host])
        : strings([row.host]);
  const address = hosts.map((h) => (row.port != null ? `${h}:${row.port}` : h)).join(' · ');
  return {
    label: row.resource_name || address || row.resource_id,
    databaseType: row.database_type ?? null,
    sourceIps: strings(row.idc_source_ips),
  };
}

const EMPTY: ReadonlyMap<string, InstallResourceIdentity> = new Map();

export function useInstallResourceIdentity(
  targetSourceId: number,
  enabled: boolean,
): ReadonlyMap<string, InstallResourceIdentity> {
  // Keyed by target so a stale read never labels another target's rows.
  const [loaded, setLoaded] = useState<{ id: number; map: ReadonlyMap<string, InstallResourceIdentity> } | null>(
    null,
  );
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((data) =>
        setLoaded({
          id: targetSourceId,
          map: new Map((data.resource_infos ?? []).map((r) => [r.resource_id, installResourceIdentity(r)])),
        }),
      )
      .catch(() => {
        // Not confirmed yet (404), aborted, or down: the rows print the wire id.
      });
    return () => controller.abort();
  }, [targetSourceId, enabled]);
  return loaded?.id === targetSourceId ? loaded.map : EMPTY;
}
