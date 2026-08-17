import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttemptDetail } from '@/app/admin/pipelines/_detail/AttemptDetail';
import { attemptWindow, j, RunWindow } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import { failHead } from '@/app/admin/pipelines/_detail/JobStatus';
import type { ReactNode } from 'react';
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

const html = (a: TaskAttemptView, runWindow: ReactNode = null): string =>
  renderToStaticMarkup(
    <AttemptDetail
      attempt={a}
      operation={null}
      runWindow={runWindow}
      onOpenViewer={noop}
      onOpenFailure={noop}
    />,
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
// The line moved to the verdict hero (owner 2026-08-16), where every value now
// carries the card's own label instead of an arrow ("시작/완료/소요를 명확하게").
describe('attemptWindow — run window', () => {
  it('names each value and writes the duration like the card does', () => {
    // 5s apart — fmtElapsedMs says "5초" where spanLabel used to say "5s".
    expect(attemptWindow(attempt())).toEqual([
      { k: '시작', v: '2026-07-13 09:00' },
      { k: '완료', v: '09:00' },
      { k: '소요', v: '5초' },
    ]);
  });

  it('keeps the date on 완료 when the attempt crosses midnight', () => {
    const a = attempt({ started_at: '2026-07-13T14:50:00Z', finished_at: '2026-07-13T15:10:00Z' });
    expect(attemptWindow(a)).toEqual([
      { k: '시작', v: '2026-07-13 23:50' },
      { k: '완료', v: '2026-07-14 00:10' },
      { k: '소요', v: '20분' },
    ]);
  });

  // A dangling "완료 -" reads as a value; the label goes with the missing value.
  it('says only 시작 while the attempt is still running', () => {
    const a = attempt({ status: 'IN_PROGRESS', error_code: null, finished_at: null });
    expect(attemptWindow(a)).toEqual([{ k: '시작', v: '2026-07-13 09:00' }]);
  });

  // The attempt body is always open now, so a single-attempt task would print the
  // flow card's own timestamps a second time if this block rendered there. The
  // caller decides (TerraformExec passes null below the second attempt).
  it('is not built by the attempt body itself', () => {
    expect(html(attempt())).not.toContain('2026-07-13 09:00');
  });

  // 시안 C — the window captions the Job list it belongs to, not the hero, and
  // owner 2026-08-17: one labelled row per value, not one joined line.
  it('captions Job 현황 with one row per value', () => {
    const out = html(attempt({ job_states: [jobState()] }), <RunWindow attempt={attempt()} />);
    expect(out.indexOf('Job 현황')).toBeLessThan(out.indexOf('시작'));
    expect(out.indexOf('시작')).toBeLessThan(out.indexOf('총 1건'));
    // Each label sits in its own row with its own value — no ' · ' joiner.
    expect(out).toContain('>시작</span><span class="text-[var(--pl-text-medium)]">2026-07-13 09:00<');
    expect(out).toContain('>완료</span><span class="text-[var(--pl-text-medium)]">09:00<');
    expect(out).toContain('>소요</span><span class="text-[var(--pl-text-medium)]">5초<');
  });
});

// 시안 B — the raw dispatch body is the JSON the job rows are derived from, so it
// only earns its fold when there are no rows to derive.
describe('AttemptDetail — Response 원문', () => {
  it('is hidden while the attempt has job rows', () => {
    const out = html(attempt({ response: '{"job_id":"tf-1"}', job_states: [jobState()] }));
    expect(out).not.toContain('Response 원문');
  });

  it('is kept when there are no job rows to derive it from', () => {
    const out = html(attempt({ response: '{"job_id":"tf-1"}' }));
    expect(out).toContain('Response 원문');
    expect(out).toContain('tf-1'); // the body itself, HTML-escaped by the renderer
  });
});

// 시안 A·B — the counts ARE the filter (they used to be a caption that could only
// be read), the list opens on the failures, and every row says what its job last
// did and opens the log end to end. Owner 2026-08-17: the filter is a dropdown in
// the list's own header card, because four buckets of segments wrapped.
describe('AttemptDetail — Job 현황', () => {
  const ok = (n: number): TerraformJobStateSummary[] =>
    Array.from({ length: n }, (_, i) => jobState({ job_id: `ok-${i + 1}`, last_state: 'COMPLETED' }));
  const bad = jobState({
    job_id: 'bad-1',
    last_state: 'FAILED',
    last_fail_reason: 'Error acquiring the state lock: ConditionalCheckFailedException: The conditional request failed',
  });

  it('states the total, opens on the failures, and keeps the count on the trigger', () => {
    const out = html(attempt({ job_states: [...ok(20), bad] }));
    expect(out).toContain('aria-label="Job 상태 필터"');
    // The header states the scale; the closed trigger states the active bucket.
    expect(out).toContain('총 21건');
    expect(out).toContain('실패 1');
    // The other buckets are in the list the trigger opens, not in the markup.
    expect(out).not.toContain('성공 20');
    // The failure and the KIND of failure are on screen without opening anything —
    // the detail after the colon belongs to the log viewer's header, not this row.
    expect(out).toContain('>bad-1<');
    expect(out).toContain('>Error acquiring the state lock</p>');
    expect(out).not.toContain('ConditionalCheckFailedException');
    // …and the 20 settled successes are not in the way.
    expect(out).not.toContain('>ok-1<');
  });

  it('sorts what is still moving above what has settled', () => {
    // No failure → the filter opens on 전체, so the ordering is observable.
    const out = html(attempt({ job_states: [...ok(3), jobState({ job_id: 'run-1' })] }));
    expect(out.indexOf('>run-1<')).toBeLessThan(out.indexOf('>ok-1<'));
  });

  // One bucket is nothing to pick between — the filter is then its own label, and
  // 전체 next to it would say the same number twice.
  it('drops the control entirely when a single verdict covers every job', () => {
    const out = html(attempt({ job_states: ok(5) }));
    expect(out).toContain('>ok-5<');
    expect(out).toContain('총 5건');
    expect(out).toContain('성공 5');
    expect(out).not.toContain('aria-label="Job 상태 필터"');
    expect(out).not.toContain('전체');
  });

  it('says what each job last did — state, polls, clock', () => {
    const out = html(
      attempt({
        job_states: [jobState({ job_id: 'run-1', poll_count: 6, last_polled_at: '2026-07-13T00:00:00Z' })],
      }),
    );
    expect(out).toContain('RUNNING · 6회 폴링 · 09:00');
  });

  // The reason column is one line. A clipping box also paints the clipped remainder
  // into its own padding box, so the bottom gap has to be a margin — with `pb-3` a
  // real three-line terraform error rendered a sliced third line under a two-line clamp.
  it('keeps the failure reason to one line, with no bottom padding', () => {
    expect(j.jobFailReason).toContain('truncate');
    expect(j.jobFailReason).not.toContain('line-clamp');
    expect(j.jobFailReason).not.toMatch(/\bp[by]-/);
  });

  // A terraform error names its class first and details itself after the colon.
  it('takes the head clause, and drops a leading Error: prefix', () => {
    expect(failHead('Error acquiring the state lock: ConditionalCheckFailedException: x')).toBe(
      'Error acquiring the state lock',
    );
    expect(failHead('Error: creating EC2 Instance: InvalidSubnetID.NotFound')).toBe('creating EC2 Instance');
    // No colon — nothing to cut, and `truncate` is the only bound left.
    expect(failHead('infra-manager call failed')).toBe('infra-manager call failed');
  });

  it('makes the whole row the log entry point', () => {
    const out = html(attempt({ job_states: ok(1) }));
    expect(out).toContain('aria-label="TerraformJob ok-1 · 성공 · 로그 열기"');
    expect(out).not.toContain('로그 보기');
  });
});
