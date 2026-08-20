/**
 * DAG weekly health status — ASSUMED CONTRACT
 * (docs/api/ops-assumed-contracts.md §10, owner sketch 2026-08-19).
 *
 * GET /install/v1/target-sources/{targetSourceId}/dag-status
 *
 * Wire is camelCase VERBATIM per the sketch — the one ops-assumed endpoint that
 * does not speak snake. No case boundary anywhere on this path.
 *
 * `healthStatus` and the `connectionStatus` fields are typed as plain strings on
 * purpose: consumers gate by allowlist (`=== 'HEALTHY'`), never by negation, so
 * an enum value we have not seen locks instead of passing.
 */

export type DagDayRunStatus = 'SUCCESS' | 'RUNNING' | 'FAILED' | 'NOT_SCHEDULED';

export interface DagDayStatus {
  /** YYYY-MM-DD, KST bucket. */
  day: string;
  /** Declared enum is DagDayRunStatus; kept open for unseen values. */
  status: string;
  /** Present only on SUCCESS days. */
  successTime: string | null;
}

export interface DagDatabaseStatus {
  databaseUri: string;
  /** null until Infra Manager redeploy ships the name. */
  databaseName: string | null;
  schemaName: string | null;
  dagName: string | null;
  namespace: string | null;
  succeededThisWeek: boolean;
  lastSuccessAt: string | null;
  /** Exactly 7 entries. */
  days: DagDayStatus[];
}

export interface DagAgentStatus {
  agentId: string;
  resourceId: string;
  /** GCP vocabulary — the non-GCP field name is an open contract question (§10). */
  gcpRegion: string | null;
  /** TestConnectionStatus enum, monitoring's own reading — not the TC tab's source. */
  connectionStatus: string;
  databaseStatuses: DagDatabaseStatus[];
}

export interface DagStatusResponse {
  targetSourceId: number;
  connectionStatus: string;
  /** Declared "HEALTHY" | "UNHEALTHY" — gate by allowlist, treat the rest as unknown. */
  healthStatus: string;
  timezone: string;
  agents: DagAgentStatus[];
}
