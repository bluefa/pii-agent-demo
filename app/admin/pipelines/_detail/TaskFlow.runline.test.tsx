import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskFlow } from '@/app/admin/pipelines/_detail/TaskFlow';
import type { TaskSummary } from '@/lib/pipeline/types';

const task = (over: Partial<TaskSummary> & Pick<TaskSummary, 'sequence' | 'status'>): TaskSummary => ({
  task_id: over.task_id ?? over.sequence,
  sequence: over.sequence,
  kind: 'TERRAFORM_JOB',
  task_definition: `def_${over.sequence}`,
  operation: null,
  terraform_action: null,
  status: over.status,
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: null,
  started_at: over.started_at ?? null,
  finished_at: over.finished_at ?? null,
  description: null,
});

const html = (tasks: TaskSummary[], now?: number | null): string =>
  renderToStaticMarkup(
    <TaskFlow
      tasks={tasks}
      resolveName={(t) => t.task_definition}
      resolveMeta={() => ''}
      onOpen={vi.fn()}
      now={now}
    />,
  );

const RUNNING = task({ sequence: 0, status: 'IN_PROGRESS', started_at: '2026-08-14T10:41:00Z' });
const DONE = task({
  sequence: 1, status: 'DONE',
  started_at: '2026-08-14T10:41:00Z', finished_at: '2026-08-14T10:43:00Z',
});

/** The rendered `.nd-run-el` slot, tags stripped ("경과 7분"). Reading the slot and
 *  not the whole markup on purpose: the canvas ships a <style> block whose comment
 *  mentions 소요, so a substring search over the document is always "true". */
const runEl = (out: string): string | null => {
  const m = /<span class="nd-run-el">([\s\S]*?)<\/span><\/div>/.exec(out);
  return m ? m[1].replace(/<[^>]+>/g, '') : null;
};

// Owner 2026-08-31 — a running card with no elapsed reads as stuck.
describe('TaskFlow — the run row clock', () => {
  it('counts a running card off the page clock and labels it 경과', () => {
    expect(runEl(html([RUNNING], Date.parse('2026-08-14T10:48:00Z')))).toBe('경과 7분');
  });

  it('keeps 소요 for a card that finished — the label says which clock it is', () => {
    expect(runEl(html([DONE], Date.parse('2026-08-14T10:48:00Z')))).toBe('소요 2분');
  });

  it('says nothing on a running card until the page clock has ticked', () => {
    expect(runEl(html([RUNNING], null))).toBeNull();
    expect(runEl(html([RUNNING]))).toBeNull();
  });

  it('raises only the digits — the unit stays at the label size', () => {
    expect(html([RUNNING], Date.parse('2026-08-14T10:48:00Z')))
      .toContain('경과 <span class="nd-run-el-v">7</span>분');
  });
});

// The same task wore a link on the run card and the condition-gate check here.
describe('TaskFlow — HTTP_REQUEST marks', () => {
  const http = (task_definition: string): TaskSummary => ({
    ...task({ sequence: 7, status: 'READY' }),
    kind: 'HTTP_REQUEST',
    operation: 'UNKNOWN',
    task_definition,
  });

  it('marks an AWS China install task by its definition', () => {
    const out = html([http('AWS_SERVICE_ACCOUNT_CREATE_V1')]);
    expect(out).toContain('title="Service Account 생성"');
    expect(out).not.toContain('조건 확인');
  });

  it('falls back to the HTTP link, never the condition check', () => {
    const out = html([http('SOMETHING_NEW_V1')]);
    expect(out).toContain('title="HTTP 요청"');
    expect(out).not.toContain('title="조건 확인(폴링)"');
  });
});
