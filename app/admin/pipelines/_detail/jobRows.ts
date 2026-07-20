/**
 * Derive the per-job list of a TERRAFORM_JOB attempt from `terraform_results ∪
 * job_states`, joined on `job_id`. The attempt's `response` (a raw external
 * string) is NEVER parsed for this — the two typed arrays are the source of
 * truth. `job_states` seeds the rows (every polled job has a state); a
 * `terraform_result` attaches to its job when the attempt reached judgment.
 */
import type {
  TaskAttemptView,
  TaskOperation,
  TerraformJobResultSummary,
  TerraformJobStateSummary,
} from '@/lib/pipeline/types';

export interface JobRow {
  job_id: string;
  result: TerraformJobResultSummary | null;
  state: TerraformJobStateSummary | null;
}

/** success = terminal-OK · failed = terminal-fail · running = still going · none = no observation. */
export type JobVerdict = 'success' | 'failed' | 'running' | 'none';

export function jobRows(attempt: TaskAttemptView): JobRow[] {
  // Defensive: the proxy passes upstream responses verbatim, so guard against a
  // payload that omits either array even though the contract marks them present.
  const states = attempt.job_states ?? [];
  const results = attempt.terraform_results ?? [];
  const byId = new Map<string, JobRow>();
  for (const state of states) {
    byId.set(state.job_id, { job_id: state.job_id, result: null, state });
  }
  for (const result of results) {
    const row = byId.get(result.job_id) ?? { job_id: result.job_id, result: null, state: null };
    row.result = result;
    byId.set(result.job_id, row);
  }
  return [...byId.values()];
}

/**
 * Terminal-success `terraformState` values per job type, mirroring the backend
 * `TerraformJobType` (PLAN/APPLY/DESTROY). PLAN completes as CREATED, DESTROY as
 * DESTROYED, and COMPLETED/COMPLETE are common to all — so the raw state alone is
 * ambiguous without the operation (a bare COMPLETED could be any type). `FAILED`
 * is the universal failure terminal; every other/absent state is still-running.
 */
const TF_SUCCESS_STATES = {
  PLAN: ['CREATED', 'COMPLETED', 'COMPLETE'],
  APPLY: ['COMPLETED', 'COMPLETE'],
  DESTROY: ['COMPLETED', 'DESTROYED', 'COMPLETE'],
} as const;

/** Union of every type's success states — the fallback when the operation (hence job type) is unknown. */
const ANY_TF_SUCCESS_STATE = ['CREATED', 'COMPLETED', 'COMPLETE', 'DESTROYED'];

const TF_FAILED_STATE = 'FAILED';

/** Classify the terraform operation into its job type by suffix (`NETWORK_READY` / null → not terraform). */
function tfJobType(operation: TaskOperation | null | undefined): keyof typeof TF_SUCCESS_STATES | null {
  if (!operation) return null;
  if (operation.endsWith('_TF_PLAN')) return 'PLAN';
  if (operation.endsWith('_TF_APPLY')) return 'APPLY';
  if (operation.endsWith('_TF_DESTROY')) return 'DESTROY';
  return null;
}

/**
 * A job's verdict. A recorded result wins (its `succeeded` is the judgment);
 * otherwise fall back to the raw `last_state`, interpreting the terminal
 * vocabulary the server judges on for this `operation`'s job type (PLAN success =
 * CREATED/COMPLETED/COMPLETE, APPLY = COMPLETED/COMPLETE, DESTROY =
 * COMPLETED/DESTROYED/COMPLETE; FAILED = fail). Without the operation, any type's
 * success state counts (union). Any other/absent state is still-running / unobserved.
 */
export function jobVerdict(row: JobRow, operation?: TaskOperation | null): JobVerdict {
  if (row.result) {
    if (row.result.succeeded === true) return 'success';
    if (row.result.succeeded === false) return 'failed';
    return 'running';
  }
  const state = row.state?.last_state;
  if (!state) return 'none';
  if (state === TF_FAILED_STATE) return 'failed';
  const type = tfJobType(operation);
  const successStates: readonly string[] = type ? TF_SUCCESS_STATES[type] : ANY_TF_SUCCESS_STATE;
  return successStates.includes(state) ? 'success' : 'running';
}
