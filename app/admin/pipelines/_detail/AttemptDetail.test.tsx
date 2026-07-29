import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttemptDetail } from '@/app/admin/pipelines/_detail/AttemptDetail';
import type { TaskAttemptView, TerraformJobStateSummary } from '@/lib/pipeline/types';

const noop = vi.fn();

const attempt = (over: Partial<TaskAttemptView> = {}): TaskAttemptView => ({
  attempt_number: 1,
  status: 'FAILED',
  error_code: 'CHECK_ERROR',
  response: null,
  failure_detail: null,
  started_at: '2026-07-13T00:00:00Z',
  finished_at: '2026-07-13T00:00:05Z',
  check: null,
  terraform_results: [],
  job_states: [],
  ...over,
});

const jobState = (over: Partial<TerraformJobStateSummary> = {}): TerraformJobStateSummary => ({
  job_id: 'job-1',
  last_state: 'RUNNING',
  last_fail_reason: null,
  last_error: null,
  poll_count: 1,
  last_polled_at: null,
  ...over,
});

const html = (a: TaskAttemptView): string =>
  renderToStaticMarkup(
    <AttemptDetail attempt={a} operation={null} onOpenViewer={noop} onOpenFailure={noop} />,
  );

// A terraform dispatch-call failure yields a FAILED attempt with zero job rows: there is no
// job row, so no per-job log viewer to reach. The attempt must then surface `failure_detail`.
describe('AttemptDetail — failure cause when there are no job rows', () => {
  it('surfaces failure_detail for a FAILED attempt with no jobs', () => {
    const out = html(attempt({ failure_detail: 'infra-manager call failed: 503 Service Unavailable' }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('infra-manager call failed: 503 Service Unavailable');
  });

  it('falls back to error_code when failure_detail is absent', () => {
    const out = html(attempt({ failure_detail: null, error_code: 'CALL_TIMEOUT' }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('CALL_TIMEOUT');
  });

  it('keeps the compact behavior (no cause block) when the attempt has job rows', () => {
    const out = html(attempt({ failure_detail: 'should stay hidden', job_states: [jobState()] }));
    expect(out).toContain('Terraform Job');
    expect(out).not.toContain('실패 원인');
    expect(out).not.toContain('should stay hidden');
  });

  it('shows no cause block for a non-failed attempt with no jobs', () => {
    const out = html(attempt({ status: 'IN_PROGRESS', error_code: null }));
    expect(out).not.toContain('실패 원인');
  });

  it('offers a 자세히 button when the cause is long (opens the modal)', () => {
    const long = 'infra-manager call failed: ' + 'x'.repeat(200);
    const out = html(attempt({ failure_detail: long }));
    expect(out).toContain('실패 원인');
    expect(out).toContain('자세히');
  });

  it('shows no 자세히 button for a short cause', () => {
    const out = html(attempt({ failure_detail: 'infra-manager call failed: 503' }));
    expect(out).toContain('실패 원인');
    expect(out).not.toContain('자세히');
  });
});

describe('AttemptDetail — Terraform Job pagination', () => {
  const jobs = (n: number): TerraformJobStateSummary[] =>
    Array.from({ length: n }, (_, i) => jobState({ job_id: `job-${i + 1}` }));

  it('renders only the first page and the total count when there are more than 10 jobs', () => {
    const out = html(attempt({ job_states: jobs(25) }));
    expect(out).toContain('총 25개');
    expect(out).toContain('1 / 3');
    expect(out).toContain('>job-10<');
    expect(out).not.toContain('>job-11<');
  });

  it('renders every job with no pager at 10 or fewer', () => {
    const out = html(attempt({ job_states: jobs(10) }));
    expect(out).toContain('>job-10<');
    expect(out).not.toContain('총 10개');
    expect(out).not.toContain('1 / 1');
  });
});
