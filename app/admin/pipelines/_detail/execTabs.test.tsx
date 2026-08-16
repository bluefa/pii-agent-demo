import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerraformExec } from '@/app/admin/pipelines/_detail/execTabs';
import type { TaskAttemptView, TaskDetail, TerraformJobStateSummary } from '@/lib/pipeline/types';

const noop = vi.fn();

const jobState = (over: Partial<TerraformJobStateSummary> = {}): TerraformJobStateSummary => ({
  job_id: 'job-1',
  last_state: 'COMPLETED',
  last_fail_reason: null,
  last_error: null,
  poll_count: 1,
  last_polled_at: null,
  ...over,
});

const attempt = (n: number, over: Partial<TaskAttemptView> = {}): TaskAttemptView => ({
  attempt_number: n,
  status: 'FAILED',
  error_code: 'CHECK_ERROR',
  response: null,
  failure_detail: null,
  started_at: '2026-07-13T00:00:00Z',
  finished_at: '2026-07-13T00:00:05Z',
  check: null,
  terraform_results: [],
  job_states: [jobState({ job_id: `a${n}-job` })],
  ...over,
});

const detail = (attempts: TaskAttemptView[]): TaskDetail => ({
  task_id: 1,
  pipeline_id: 1,
  sequence: 0,
  kind: 'TERRAFORM_JOB',
  task_definition: 'AWS_SERVICE_LEVEL',
  definition: null,
  operation: 'AWS_SERVICE_TF_APPLY',
  terraform_action: 'APPLY',
  status: 'FAILED',
  fail_count: attempts.length,
  error_code: 'JOB_FAILED',
  consumes_terraform_slot: true,
  started_at: '2026-07-13T00:00:00Z',
  ready_at: null,
  finished_at: null,
  next_check_at: null,
  effective_polling_interval: 'PT10M',
  effective_execution_timeout: 'PT50M',
  effective_max_fail_count: 2,
  attempts,
  description: null,
});

const html = (d: TaskDetail): string =>
  renderToStaticMarkup(<TerraformExec detail={d} onOpenViewer={noop} onOpenFailure={noop} />);

// Owner 2026-08-16: "다른 시도의 작업을 확인할 방법은 없나?" — the older attempts'
// jobs used to be two clicks deep (시도 이력 row → fold). The picker puts every
// attempt one click away and the body always shows one of them.
describe('TerraformExec — attempt picker', () => {
  it('names the newest attempt on a closed trigger and opens on its jobs', () => {
    const out = html(detail([attempt(1), attempt(2)]));
    // Closed, the picker is one trigger — the list mounts on click (owner
    // 2026-08-17: the repo's popover, not a native select that ships every
    // option into the markup).
    expect(out).toContain('aria-label="시도 선택"');
    expect(out).toContain('시도 #2');
    expect(out).not.toContain('시도 #1');
    // The newest attempt's jobs are the ones on screen…
    expect(out).toContain('a2-job');
    // …and the older attempt's are one click away, not rendered twice.
    expect(out).not.toContain('a1-job');
  });

  it('drops the picker for a single attempt and still shows its jobs', () => {
    const out = html(detail([attempt(1)]));
    expect(out).not.toContain('aria-label="시도 선택"');
    expect(out).toContain('a1-job');
  });

  it('prints the selected attempt window only when there is more than one attempt', () => {
    // A single attempt repeats the flow card's own timestamps — the card owns them.
    expect(html(detail([attempt(1)]))).not.toContain('시작 2026-07-13 09:00');
    expect(html(detail([attempt(1), attempt(2)]))).toContain(
      '시작 2026-07-13 09:00 · 완료 09:00 · 소요 5초',
    );
  });

  // Owner 2026-08-17: the retry budget is off this row. The picker's trigger
  // names the current attempt and its list counts them; the budget itself is on
  // the exec band (재시도 f/m) while a run is live, and in 정의·계약 as a contract
  // value. A settled task has no remaining budget to report.
  it('prints no retry budget on the verdict row', () => {
    expect(html(detail([attempt(1)]))).not.toContain('시도 1/2회');
    expect(html(detail([attempt(1), attempt(2)]))).not.toContain('시도 2/2회');
  });

  it('says so instead of rendering an empty body when nothing ran yet', () => {
    expect(html(detail([]))).toContain('아직 시도 없음');
  });
});
