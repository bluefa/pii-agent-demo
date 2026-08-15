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
    expect(out).toContain('Job 현황');
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

// 시안 C — one run line in the card's duration grammar, not a second one ("5m 0s").
describe('AttemptDetail — run window', () => {
  it('drops the repeated date and writes the duration like the card does', () => {
    // 5s apart — fmtElapsedMs says "5초" where spanLabel used to say "5s".
    const out = html(attempt());
    expect(out).toContain('2026-07-13 09:00 → 09:00 · 5초');
  });

  it('keeps the date on the end when the attempt crosses midnight', () => {
    const out = html(attempt({ started_at: '2026-07-13T14:50:00Z', finished_at: '2026-07-13T15:10:00Z' }));
    expect(out).toContain('2026-07-13 23:50 → 2026-07-14 00:10 · 20분');
  });

  it('states no duration while the attempt is still running', () => {
    const out = html(attempt({ status: 'IN_PROGRESS', error_code: null, finished_at: null }));
    expect(out).toContain('2026-07-13 09:00 → -');
    expect(out).not.toContain(' · ');
  });
});

// 시안 B — the job list answers "how many of them failed" before the rows, puts the
// failures first, and folds the settled successes instead of paging them away.
describe('AttemptDetail — Job 현황', () => {
  const ok = (n: number): TerraformJobStateSummary[] =>
    Array.from({ length: n }, (_, i) => jobState({ job_id: `ok-${i + 1}`, last_state: 'COMPLETED' }));
  const bad = jobState({ job_id: 'bad-1', last_state: 'FAILED', last_fail_reason: 'mock forced failure' });

  it('counts every bucket and folds the successes past 5 jobs', () => {
    const out = html(attempt({ job_states: [...ok(20), bad] }));
    expect(out).toContain('총 21개');
    expect(out).toContain('성공 20개 펼치기');
    // The failure and its reason are on screen without opening anything…
    expect(out).toContain('>bad-1<');
    expect(out).toContain('mock forced failure');
    // …and no success row is drawn while folded.
    expect(out).not.toContain('>ok-1<');
  });

  it('puts the failure above the successes once unfolded', () => {
    const out = html(attempt({ job_states: [...ok(3), bad] }));
    expect(out.indexOf('>bad-1<')).toBeLessThan(out.indexOf('>ok-1<'));
  });

  it('renders every job with no fold at 5 or fewer', () => {
    const out = html(attempt({ job_states: ok(5) }));
    expect(out).toContain('>ok-5<');
    expect(out).toContain('총 5개');
    expect(out).not.toContain('펼치기');
  });

  it('offers no fold when there is nothing settled to hide', () => {
    const out = html(attempt({ job_states: Array.from({ length: 6 }, (_, i) => jobState({ job_id: `run-${i}` })) }));
    expect(out).toContain('>run-5<');
    expect(out).not.toContain('펼치기');
  });
});
