import { describe, expect, it } from 'vitest';
import { jobRows, jobTally, jobTallyKo, jobVerdict, type JobRow } from '@/app/admin/pipelines/_detail/jobRows';
import type {
  TaskAttemptView,
  TerraformJobResultSummary,
  TerraformJobStateSummary,
} from '@/lib/pipeline/types';

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
  const result = (succeeded: boolean | null): TerraformJobResultSummary => ({
    job_id: 'x', succeeded, truncated: false, has_body: true, created_at: 'x',
  });
  const state = (last_state: string | null): TerraformJobStateSummary => ({
    job_id: 'x', last_state, last_fail_reason: null, last_error: null, poll_count: 1, last_polled_at: null,
  });
  const row = (r: TerraformJobResultSummary | null, s: TerraformJobStateSummary | null): JobRow => ({
    job_id: 'x', result: r, state: s,
  });

  it('recorded result wins over raw state', () => {
    expect(jobVerdict(row(result(true), state('FAILED')))).toBe('success');
    expect(jobVerdict(row(result(false), state('COMPLETED')))).toBe('failed');
    expect(jobVerdict(row(result(null), state('COMPLETED')))).toBe('running');
  });

  it('falls back to terminal state vocabulary when no result', () => {
    expect(jobVerdict(row(null, state('COMPLETED')))).toBe('success');
    expect(jobVerdict(row(null, state('DESTROYED')))).toBe('success');
    expect(jobVerdict(row(null, state('FAILED')))).toBe('failed');
    expect(jobVerdict(row(null, state('RUNNING')))).toBe('running');
    expect(jobVerdict(row(null, state(null)))).toBe('none');
    expect(jobVerdict(row(null, null))).toBe('none');
  });

  it('reads each operation type\'s own success vocabulary (PLAN=CREATED, APPLY=COMPLETE, DESTROY=DESTROYED)', () => {
    // PLAN completes as CREATED — the state the old code mislabeled as still-running.
    expect(jobVerdict(row(null, state('CREATED')), 'AWS_SERVICE_TF_PLAN')).toBe('success');
    expect(jobVerdict(row(null, state('COMPLETE')), 'AWS_SERVICE_TF_APPLY')).toBe('success');
    expect(jobVerdict(row(null, state('DESTROYED')), 'AWS_SERVICE_TF_DESTROY')).toBe('success');
    expect(jobVerdict(row(null, state('COMPLETED')), 'GCP_BDC_TF_APPLY')).toBe('success');
    expect(jobVerdict(row(null, state('FAILED')), 'AWS_SERVICE_TF_PLAN')).toBe('failed');
  });

  it('does not accept a state outside the given type\'s success list', () => {
    // CREATED is a PLAN terminal, not an APPLY one — for an APPLY job it is still-running.
    expect(jobVerdict(row(null, state('CREATED')), 'AWS_SERVICE_TF_APPLY')).toBe('running');
    expect(jobVerdict(row(null, state('DESTROYED')), 'AWS_SERVICE_TF_PLAN')).toBe('running');
  });

  it('unions all types\' success states when the operation is unknown', () => {
    expect(jobVerdict(row(null, state('CREATED')))).toBe('success');
    expect(jobVerdict(row(null, state('COMPLETE')))).toBe('success');
    expect(jobVerdict(row(null, state('CREATED')), null)).toBe('success');
    expect(jobVerdict(row(null, state('RUNNING')), 'NETWORK_READY')).toBe('running');
  });
});

describe('jobTally', () => {
  const state = (job_id: string, last_state: string | null): TerraformJobStateSummary => ({
    job_id, last_state, last_fail_reason: null, last_error: null, poll_count: 1, last_polled_at: null,
  });
  const result = (job_id: string, succeeded: boolean | null): TerraformJobResultSummary => ({
    job_id, succeeded, truncated: false, has_body: true, created_at: 'x',
  });

  it('counts each verdict and keeps 성공 · 실패 · timeout in that order', () => {
    const t = jobTally(
      attempt({
        job_states: [
          state('1', 'COMPLETED'), state('2', 'COMPLETED'), state('3', 'COMPLETED'), state('4', 'COMPLETED'),
          state('5', 'FAILED'), state('6', 'FAILED'), state('7', 'FAILED'),
          state('8', 'RUNNING'),
        ],
      }),
      'AWS_SERVICE_TF_APPLY',
    );
    expect(t.total).toBe(8);
    expect(t.parts).toEqual(['4개 성공', '3개 실패', '1개 timeout']);
    expect(jobTallyKo(attempt({ job_states: [state('1', 'COMPLETED'), state('2', 'FAILED')] })))
      .toBe('job 2개 중 1개 성공, 1개 실패');
  });

  it('omits a bucket nobody landed in', () => {
    const t = jobTally(
      attempt({
        terraform_results: [result('1', true), result('2', true)],
        job_states: [state('1', 'COMPLETED'), state('2', 'COMPLETED'), state('3', 'RUNNING')],
      }),
      'AWS_SERVICE_TF_APPLY',
    );
    expect(t.parts).toEqual(['2개 성공', '1개 timeout']);
  });

  it('counts an unobserved job as timeout, not as a missing row', () => {
    // No result and no state = the judgment never resolved it — the same bucket
    // as a job still RUNNING when the execution limit expired.
    const t = jobTally(attempt({ terraform_results: [result('9', null)] }));
    expect(t).toEqual({ total: 1, parts: ['1개 timeout'] });
  });

  it('says nothing when the attempt ran no jobs', () => {
    expect(jobTally(attempt({}))).toEqual({ total: 0, parts: [] });
    expect(jobTallyKo(attempt({}))).toBeNull();
  });
});
