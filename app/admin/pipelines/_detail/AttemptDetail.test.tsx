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
  renderToStaticMarkup(<AttemptDetail attempt={a} operation={null} onOpenViewer={noop} />);

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
});
