/**
 * Test Connection (Step 5/6) — BFF wire DTOs (snake_case).
 *
 * Source of truth: `docs/swagger/install-v1.yaml` (operationIds
 * requestTestConnection / getLatestTestConnectionStatus /
 * getLatestTestConnectionResultSummaries / getTestConnectionCompletionStatus /
 * updateTestConnectionConfirmation). These mirror the wire shape 1:1.
 *
 * Casing (ADR-019 D1/D2): responses are camelCased at the route-handler
 * boundary (`camelCaseKeys` + a hand-written normalizer in
 * `lib/test-connection-response.ts`). The PUT request body
 * (`UpdateTestConnectionConfirmationRequest`) is passed through as-authored
 * per D3 — `confirmed` is casing-invariant.
 */

/** Shared 4-value connection state (top-level + per-agent). */
export type TestConnectionStatusWire = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAIL';

/** 202 of requestTestConnection — no `id` (dropped vs the old contract). */
export interface TestConnectionTriggerResponseWire {
  success: boolean;
}

/** Per-agent result inside TestConnectionVersionResult. */
export interface TestConnectionAgentResultWire {
  agent_id: string;
  gcp_region: string;
  resource_id: string;
  connection_status: TestConnectionStatusWire;
  database_uri_list: string[];
}

/** 200 of getLatestTestConnectionStatus (path `…/test-connection/latest_version`). */
export interface TestConnectionVersionResultWire {
  target_source_id: number;
  test_connection_version: number;
  connection_status: TestConnectionStatusWire;
  requested_at: string;
  completed_at: string;
  test_connection_agent_results: TestConnectionAgentResultWire[];
}

/** Item type of getLatestTestConnectionResultSummaries (200 is an ARRAY of these). */
export interface TestConnectionLatestResultSummaryResponseWire {
  resource_id: string;
  agent_id: string;
  logical_database_count: number;
  excluded_logical_database_count: number;
}

export type TestConnectionCompletionStatusWire =
  | 'CONFIRMED'
  | 'LATEST_TEST_CONNECTION_SUCCESS'
  | 'TEST_CONNECTION_REQUIRED'
  | 'LOGICAL_DATABASE_RECENTLY_UPDATED';

/** 200 of getTestConnectionCompletionStatus. */
export interface TestConnectionCompletionStatusResponseWire {
  target_source_id: number;
  latest_test_connection_requested_at: string;
  logical_database_updated_at: string;
  latest_test_connection_success: boolean;
  test_connection_status: TestConnectionCompletionStatusWire;
  test_connection_confirmed: boolean;
}

/** Request body of updateTestConnectionConfirmation (required: confirmed). */
export interface UpdateTestConnectionConfirmationRequestWire {
  confirmed: boolean;
}

/** 200 of updateTestConnectionConfirmation. */
export interface TestConnectionConfirmationResponseWire {
  target_source_id: number;
  confirmed: boolean;
  confirmed_at: string;
}
