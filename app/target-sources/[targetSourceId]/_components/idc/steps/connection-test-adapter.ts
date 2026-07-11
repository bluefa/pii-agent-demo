/**
 * Connection test adapter — joins the confirmed resource list with
 * per-agent connection_status from the latest test poll result.
 *
 * Pure CSR function: no zod, no defensive reads. Inputs are already-validated
 * zod wire types. Output is a camel VIEW used by the IDC/cloud UI row table.
 */

import type { TestConnectionVersionResult, TestConnectionStatus } from '@/app/lib/api';

/** Camel VIEW type: the join output rendered per-row in the connection-test table. */
export interface ConnectionTestRow {
  /** resource_id from the confirmed integration (snake preserved — it's an opaque ID). */
  resourceId: string;
  /** Connection result from the latest poll, or undefined when no run has settled. */
  connectionStatus: TestConnectionStatus | undefined;
}

/**
 * Build per-resource connection status rows by joining the resource list with
 * `latestJob.test_connection_agent_results`, keyed by `resource_id`.
 *
 * Returns one row per resource. `connectionStatus` is undefined when the resource
 * has no result in the latest job (e.g. no run yet, or agent skipped it).
 */
export const buildConnectionTestRows = (
  resourceIds: string[],
  latestJob: TestConnectionVersionResult | null,
): ConnectionTestRow[] => {
  const statusByResourceId: Record<string, TestConnectionStatus> = {};
  for (const agent of latestJob?.test_connection_agent_results ?? []) {
    // schema is .partial() (no `required` in swagger) — fields are optional on the wire.
    if (agent.resource_id && agent.connection_status) {
      statusByResourceId[agent.resource_id] = agent.connection_status;
    }
  }
  return resourceIds.map((resourceId) => ({
    resourceId,
    connectionStatus: statusByResourceId[resourceId],
  }));
};
