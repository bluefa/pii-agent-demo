/**
 * The reconciled list, in the shape each provider's table already reads.
 *
 * The join itself is provider-agnostic (`reconcile.ts`); what differs is the row the table
 * wants. Cloud rows go through the confirmed shape steps 6·7 print, IDC rows through the
 * request shape every IDC table prints — the same two shapes the tab drew before, so the
 * columns a reader learned do not move when a 판정 column joins them.
 *
 * A row the approval names but the confirmed record does not still has to appear, so the
 * approved row is converted INTO the display shape. Only the fields the approval actually
 * carries are filled: the confirmed-only facts (host, port, credential) are left null rather
 * than guessed, and none of them has a column on these two surfaces anyway.
 */
import { reconcileResources } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/reconcile';
import { confirmedToIdcRows } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/confirmedIdcRows';
import type { ConfirmedResourceRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmedResourceTable';
import type { IdcResourceTableRow } from '@/app/admin/pipelines/queue/requests/_components/IdcResourceTable';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';
import type { ConfirmedIntegrationResponse } from '@/app/lib/api';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';

interface Counts {
  missingConfirmed: number;
  missingApproved: number;
  /** The one number the headline, the two 대조 rows and the chip row all count. */
  diffCount: number;
}

export type ReconcileTable = Counts &
  ({ kind: 'cloud'; rows: ConfirmedResourceRow[] } | { kind: 'idc'; rows: IdcResourceTableRow[] });

/** An approved row in the confirmed table's shape — identity and attributes only. */
function approvedToConfirmed(row: RequestResourceRow): ConfirmedResourceRow {
  return {
    resourceId: row.resourceId ?? '',
    type: row.resourceType ?? '',
    databaseType: row.databaseType,
    region: row.region,
    resourceName: row.resourceName,
    host: null,
    port: null,
    oracleServiceId: null,
    networkInterfaceId: null,
    ipConfigurationName: null,
    credentialId: null,
    connectionStatus: 'CONNECTED',
  };
}

export function buildReconcileTable(input: {
  isIdc: boolean;
  /** Every resource of the approved request — `reconcileResources` drops the unselected. */
  approved: readonly RequestResourceRow[];
  /** The confirmed record as it arrived; both mappers below read the response itself. */
  confirmed: ConfirmedIntegrationResponse;
}): ReconcileTable {
  const { isIdc, approved, confirmed } = input;

  if (isIdc) {
    const joined = reconcileResources(approved, confirmedToIdcRows(confirmed.resource_infos));
    return {
      kind: 'idc',
      // 두 쪽이 이미 같은 모양이다 — 확정 응답도 요청과 같은 이름으로 idc_* 를 싣는다.
      rows: joined.rows.map((row) => ({ ...(row.confirmed ?? row.approved), reconcile: row.verdict })),
      missingConfirmed: joined.missingConfirmed,
      missingApproved: joined.missingApproved,
      diffCount: joined.diffCount,
    };
  }

  const joined = reconcileResources(approved, confirmedIntegrationToConfirmed(confirmed));
  return {
    kind: 'cloud',
    rows: joined.rows.map((row) =>
      row.confirmed != null
        ? { ...row.confirmed, reconcile: row.verdict }
        : { ...approvedToConfirmed(row.approved), reconcile: row.verdict },
    ),
    missingConfirmed: joined.missingConfirmed,
    missingApproved: joined.missingApproved,
    diffCount: joined.diffCount,
  };
}
