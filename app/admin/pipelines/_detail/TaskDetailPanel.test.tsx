import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskDetailBody } from '@/app/admin/pipelines/_detail/TaskDetailPanel';
import type {
  TaskAttemptView,
  TaskCheckView,
  TaskDetail,
  TaskSummary,
} from '@/lib/pipeline/types';

const noop = (): void => {};

function summary(partial: Partial<TaskSummary> & Pick<TaskSummary, 'kind' | 'status'>): TaskSummary {
  return {
    task_id: 1,
    sequence: 0,
    kind: partial.kind,
    task_definition: partial.task_definition ?? 'network_ready',
    operation: partial.operation ?? 'NETWORK_READY',
    status: partial.status,
    fail_count: partial.fail_count ?? 0,
    error_code: partial.error_code ?? null,
    consumes_terraform_slot: partial.consumes_terraform_slot ?? null,
    started_at: partial.started_at ?? null,
    finished_at: partial.finished_at ?? null,
    description: partial.description ?? null,
  };
}

function detail(partial: Partial<TaskDetail> & Pick<TaskDetail, 'kind'>): TaskDetail {
  return {
    task_id: 1,
    pipeline_id: 10,
    sequence: partial.sequence ?? 0,
    kind: partial.kind,
    task_definition: partial.task_definition ?? 'network_ready',
    definition: partial.definition ?? null,
    operation: partial.operation ?? 'NETWORK_READY',
    status: partial.status ?? 'READY',
    fail_count: partial.fail_count ?? 0,
    error_code: partial.error_code ?? null,
    consumes_terraform_slot: partial.consumes_terraform_slot ?? null,
    started_at: partial.started_at ?? null,
    ready_at: partial.ready_at ?? null,
    finished_at: partial.finished_at ?? null,
    next_check_at: partial.next_check_at ?? null,
    effective_polling_interval: partial.effective_polling_interval ?? 'PT30S',
    effective_execution_timeout: partial.effective_execution_timeout ?? null,
    effective_max_fail_count: partial.effective_max_fail_count ?? 5,
    attempts: partial.attempts ?? [],
    description: partial.description ?? null,
  };
}

const check: TaskCheckView = {
  call_count: 12,
  not_met_count: 11,
  api_error_count: 1,
  call_timeout_count: 0,
  last_external_status: 'PENDING',
  last_checked_at: '2026-06-30T05:00:00Z',
};

const render = (props: Parameters<typeof TaskDetailBody>[0]): string => renderToStaticMarkup(<TaskDetailBody {...props} />);

describe('TaskDetailBody — CONDITION_CHECK', () => {
  it('renders the 조건 확인 contract, polling [effective], and the 폴 관찰 tail from the check', () => {
    const html = render({
      task: summary({ kind: 'CONDITION_CHECK', status: 'IN_PROGRESS' }),
      detail: detail({
        kind: 'CONDITION_CHECK',
        status: 'IN_PROGRESS',
        attempts: [{ attempt_number: 1, status: 'IN_PROGRESS', error_code: null, response: null, started_at: null, finished_at: null, check }],
      }),
      displayName: '네트워크 준비 확인',
      onClose: noop,
    });
    expect(html).toContain('네트워크 준비 확인');
    expect(html).toContain('조건 확인 — 디스패치 없이 폴링');
    expect(html).toContain('polling');
    expect(html).toContain('30초'); // fmtDuration(PT30S)
    expect(html).toContain('판정:'); // KIND_POLICY formula
    expect(html).toContain('폴 관찰 (task_check)');
    expect(html).toContain('12 / 11'); // call / not_met
    expect(html).not.toContain('TF 슬롯');
  });

  it('shows "아직 폴링 기록 없음" when no attempt carries a check', () => {
    const html = render({
      task: summary({ kind: 'CONDITION_CHECK', status: 'BLOCKED' }),
      detail: detail({ kind: 'CONDITION_CHECK', status: 'BLOCKED', attempts: [] }),
      displayName: 'cond',
      onClose: noop,
    });
    expect(html).toContain('아직 폴링 기록 없음');
    expect(html).not.toContain('폴 관찰');
  });
});

describe('TaskDetailBody — TERRAFORM_JOB', () => {
  const attempts: TaskAttemptView[] = [
    {
      attempt_number: 1,
      status: 'FAILED',
      error_code: 'JOB_FAILED',
      response: 'quota exceeded on subnet allocation',
      started_at: '2026-06-30T05:00:00Z',
      finished_at: '2026-06-30T05:01:00Z',
      check: null,
    },
  ];

  it('renders the 테라폼 잡 contract, 실행 타임아웃, TF 슬롯, and the attempts table', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'FAILED', consumes_terraform_slot: true }),
      detail: detail({
        kind: 'TERRAFORM_JOB',
        status: 'FAILED',
        error_code: 'JOB_FAILED',
        consumes_terraform_slot: true,
        effective_execution_timeout: 'PT1H',
        attempts,
      }),
      displayName: 'AWS 서비스 apply',
      onClose: noop,
    });
    expect(html).toContain('테라폼 잡 — 디스패치 후 폴링');
    expect(html).toContain('실행 타임아웃');
    expect(html).toContain('1시간'); // fmtDuration(PT1H)
    expect(html).toContain('TF 슬롯');
    expect(html).toContain('attempts — 시도별 기록');
    expect(html).toContain('quota exceeded on subnet allocation'); // response text
    expect(html).toContain('JOB_FAILED'); // error code (chip + attempt cell)
  });

  it('shows "아직 시도 없음 (BLOCKED)" and no TF 슬롯 when there are no attempts / no slot', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'BLOCKED' }),
      detail: detail({ kind: 'TERRAFORM_JOB', status: 'BLOCKED', effective_execution_timeout: 'PT1H', attempts: [] }),
      displayName: 'tf',
      onClose: noop,
    });
    expect(html).toContain('아직 시도 없음 (BLOCKED)');
    expect(html).not.toContain('TF 슬롯');
  });
});

describe('TaskDetailBody — R22 (F2) hierarchy', () => {
  it('puts 진행 기록 first and demotes 정의·실행 계약 into a collapsed reference <details>', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'DONE' }),
      detail: detail({ kind: 'TERRAFORM_JOB', status: 'DONE', effective_execution_timeout: 'PT1H' }),
      displayName: 'tf',
      onClose: noop,
    });
    expect(html.indexOf('진행 기록')).toBeLessThan(html.indexOf('task_definition'));
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('참조 정보');
    // The reference section still carries both groups (progressive disclosure,
    // not removal).
    expect(html).toContain('정의');
    expect(html).toContain('실행 계약');
  });
});

describe('TaskDetailBody — LIN-22 operator note', () => {
  it('surfaces the custom-run description with the 운영자 설명 label', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'READY' }),
      detail: detail({ kind: 'TERRAFORM_JOB', description: 'apply 재실행' }),
      displayName: 'tf',
      onClose: noop,
    });
    expect(html).toContain('운영자 설명');
    expect(html).toContain('apply 재실행');
  });

  it('omits the note entirely for catalog tasks (description null)', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'READY' }),
      detail: detail({ kind: 'TERRAFORM_JOB' }),
      displayName: 'tf',
      onClose: noop,
    });
    expect(html).not.toContain('운영자 설명');
  });
});

describe('TaskDetailBody — degraded (detail failed to load)', () => {
  it('renders a summary-only view + notice + 재시도', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'READY', operation: 'AWS_SERVICE_TF_APPLY' }),
      detail: null,
      detailLoaded: true,
      displayName: 'AWS_SERVICE_TF_APPLY',
      onClose: noop,
      onRetry: noop,
    });
    expect(html).toContain('상세를 불러오지 못했습니다');
    expect(html).toContain('재시도');
    expect(html).toContain('AWS_SERVICE_TF_APPLY');
    expect(html).not.toContain('실행 계약'); // no contract group without detail
  });
});

describe('TaskDetailBody — loading (detail not yet settled)', () => {
  it('shows neither the dgroups nor the failed notice while the fetch is in flight', () => {
    const html = render({
      task: summary({ kind: 'TERRAFORM_JOB', status: 'READY', operation: 'AWS_SERVICE_TF_APPLY' }),
      detail: null,
      detailLoaded: false,
      displayName: 'AWS_SERVICE_TF_APPLY',
      onClose: noop,
      onRetry: noop,
    });
    // Header still renders from the summary; body is a placeholder, not an error.
    expect(html).toContain('AWS_SERVICE_TF_APPLY');
    expect(html).not.toContain('상세를 불러오지 못했습니다');
    expect(html).not.toContain('실행 계약');
    expect(html).not.toContain('재시도');
  });
});
