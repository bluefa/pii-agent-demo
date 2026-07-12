/**
 * Derive the per-job list of a TERRAFORM_JOB attempt from `terraform_results ∪
 * job_states`, joined on `job_id`. The attempt's `response` (a raw external
 * string) is NEVER parsed for this — the two typed arrays are the source of
 * truth. `job_states` seeds the rows (every polled job has a state); a
 * `terraform_result` attaches to its job when the attempt reached judgment.
 */
import type {
  TaskAttemptView,
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
 * A job's verdict. A recorded result wins (its `succeeded` is the judgment);
 * otherwise fall back to the raw `last_state`, interpreting only the terminal
 * vocabulary the server itself judges on (COMPLETED/DESTROYED = ok, FAILED =
 * fail). Any other/absent state is still-running / unobserved.
 */
export function jobVerdict(row: JobRow): JobVerdict {
  if (row.result) {
    if (row.result.succeeded === true) return 'success';
    if (row.result.succeeded === false) return 'failed';
    return 'running';
  }
  const state = row.state?.last_state;
  if (state === 'COMPLETED' || state === 'DESTROYED') return 'success';
  if (state === 'FAILED') return 'failed';
  if (!state) return 'none';
  return 'running';
}
