import { describe, expect, it } from 'vitest';
import { jobRows, jobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import type { TaskAttemptView } from '@/lib/pipeline/types';

const attempt = (over: Partial<TaskAttemptView>): TaskAttemptView => ({
  attempt_number: 1,
  status: 'FAILED',
  error_code: 'JOB_FAILED',
  response: null,
  failure_detail: null,
  started_at: null,
  finished_at: null,
  check: null,
  terraform_results: [],
  job_states: [],
  ...over,
});

describe('jobRows', () => {
  it('unions results and states on job_id (state-only + result-attached + result-only)', () => {
    const rows = jobRows(
      attempt({
        job_states: [
          { job_id: '1', last_state: 'COMPLETED', last_fail_reason: null, last_error: null, poll_count: 2, last_polled_at: null },
          { job_id: '2', last_state: 'RUNNING', last_fail_reason: null, last_error: null, poll_count: 2, last_polled_at: null },
        ],
        terraform_results: [
          { job_id: '2', succeeded: false, truncated: false, has_body: true, created_at: 'x' },
          { job_id: '3', succeeded: true, truncated: false, has_body: true, created_at: 'x' },
        ],
      }),
    );
    expect(rows.map((r) => r.job_id).sort()).toEqual(['1', '2', '3']);
    const byId = Object.fromEntries(rows.map((r) => [r.job_id, r]));
    expect(byId['1'].result).toBeNull(); // state only
    expect(byId['2'].result?.succeeded).toBe(false); // result overlaid onto state row
    expect(byId['3'].state).toBeNull(); // result only
  });
});

describe('jobVerdict', () => {
  const row = (result: unknown, lastState: string | null) =>
    ({ job_id: 'x', result: result as never, state: lastState === undefined ? null : ({ last_state: lastState } as never) });

  it('recorded result wins over raw state', () => {
    expect(jobVerdict(row({ succeeded: true }, 'FAILED'))).toBe('success');
    expect(jobVerdict(row({ succeeded: false }, 'COMPLETED'))).toBe('failed');
    expect(jobVerdict(row({ succeeded: null }, 'COMPLETED'))).toBe('running');
  });

  it('falls back to terminal state vocabulary when no result', () => {
    expect(jobVerdict(row(null, 'COMPLETED'))).toBe('success');
    expect(jobVerdict(row(null, 'DESTROYED'))).toBe('success');
    expect(jobVerdict(row(null, 'FAILED'))).toBe('failed');
    expect(jobVerdict(row(null, 'RUNNING'))).toBe('running');
    expect(jobVerdict(row(null, null))).toBe('none');
  });
});
