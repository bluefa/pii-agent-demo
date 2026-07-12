import { describe, expect, it } from 'vitest';
import {
  canCancel,
  currentTask,
  currentTaskLabel,
  fmtDateTime,
  fmtDuration,
  fmtRelativeTime,
  KIND_POLICY,
  progressCount,
  providerAccentVar,
  providerKey,
  providerLabel,
  RECIPE_LABELS,
  recipeDisplayName,
  recipeLabel,
  taskMetaLine,
} from '@/lib/pipeline/format';
import type { TaskDetail, TaskStatus, TaskSummary } from '@/lib/pipeline/types';

// ── fixtures ────────────────────────────────────────────────────────────────
const summary = (over: Partial<TaskSummary>): TaskSummary => ({
  task_id: 1,
  sequence: 1,
  kind: 'TERRAFORM_JOB',
  task_definition: 'AWS_SERVICE_APPLY_V1',
  operation: 'AWS_SERVICE_TF_APPLY',
  status: 'BLOCKED',
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: true,
  started_at: null,
  finished_at: null,
  description: null,
  ...over,
});

const detail = (over: Partial<TaskDetail>): TaskDetail => ({
  task_id: 1,
  pipeline_id: 1,
  sequence: 1,
  kind: 'TERRAFORM_JOB',
  task_definition: 'AWS_SERVICE_APPLY_V1',
  definition: null,
  operation: 'AWS_SERVICE_TF_APPLY',
  status: 'BLOCKED',
  fail_count: 0,
  error_code: null,
  consumes_terraform_slot: true,
  started_at: null,
  ready_at: null,
  finished_at: null,
  next_check_at: null,
  effective_polling_interval: 'PT10M',
  effective_execution_timeout: 'PT30M',
  effective_max_fail_count: 1,
  attempts: [],
  description: null,
  ...over,
});

// 2026-06-30 05:02Z == 14:02 KST; 05:08Z == 14:08 KST.
const START = '2026-06-30T05:02:00Z';
const FINISH = '2026-06-30T05:08:00Z';

describe('fmtDateTime', () => {
  it('formats a UTC instant to YYYY-MM-DD HH:mm in Asia/Seoul', () => {
    expect(fmtDateTime(START)).toBe('2026-06-30 14:02');
  });
  it('normalizes the midnight hour (24 → 00) and rolls the date', () => {
    // 2026-06-29 15:00Z == 2026-06-30 00:00 KST.
    expect(fmtDateTime('2026-06-29T15:00:00Z')).toBe('2026-06-30 00:00');
  });
  it('returns - for null / invalid', () => {
    expect(fmtDateTime(null)).toBe('-');
    expect(fmtDateTime('not-a-date')).toBe('-');
  });
});

describe('fmtRelativeTime', () => {
  const now = new Date('2026-07-09T00:00:00Z').getTime();
  it.each([
    ['2026-07-09T00:00:00Z', '방금 전'],
    ['2026-07-08T23:59:30Z', '방금 전'],
    ['2026-07-08T23:45:00Z', '15분 전'],
    ['2026-07-08T21:00:00Z', '3시간 전'],
    ['2026-07-06T00:00:00Z', '3일 전'],
  ])('%s → %s', (iso, expected) => {
    expect(fmtRelativeTime(iso, now)).toBe(expected);
  });
  it('returns - for null / invalid', () => {
    expect(fmtRelativeTime(null, now)).toBe('-');
    expect(fmtRelativeTime('nope', now)).toBe('-');
  });
});

describe('fmtDuration', () => {
  it.each([
    ['PT10M', '10분'],
    ['PT50M', '50분'],
    ['PT30M', '30분'],
    ['PT1H', '1시간'],
    ['PT1H30M', '1시간 30분'],
  ])('%s → %s', (iso, expected) => {
    expect(fmtDuration(iso)).toBe(expected);
  });
  it('returns - for null / empty / unparseable', () => {
    expect(fmtDuration(null)).toBe('-');
    expect(fmtDuration('')).toBe('-');
    expect(fmtDuration('P1W')).toBe('-');
  });
});

describe('providerLabel / providerAccentVar / providerKey', () => {
  it('maps wire (uppercase) providers to display labels', () => {
    expect(providerLabel('AWS')).toBe('AWS');
    expect(providerLabel('AZURE')).toBe('Azure');
    expect(providerLabel('GCP')).toBe('GCP');
    expect(providerLabel('IDC')).toBe('IDC');
  });
  it('is lowercase-tolerant and passes unknown through; null → -', () => {
    expect(providerLabel('azure')).toBe('Azure');
    expect(providerLabel('XYZ')).toBe('XYZ');
    expect(providerLabel(null)).toBe('-');
  });
  it('accent var + key are lowercased', () => {
    expect(providerAccentVar('AZURE')).toBe('--pl-pv-azure');
    expect(providerAccentVar('AWS')).toBe('--pl-pv-aws');
    expect(providerKey('IDC')).toBe('idc');
  });
});

describe('RECIPE_LABELS', () => {
  it('has all 8 RecipeDefinition entries', () => {
    expect(Object.keys(RECIPE_LABELS)).toHaveLength(8);
  });
  it('mirrors the upstream displayName verbatim', () => {
    expect(RECIPE_LABELS.AWS_INSTALL_V1.displayName).toBe('AWS 인프라 설치');
    expect(recipeLabel('AZURE_DELETE_V1')?.displayName).toBe('Azure 인프라 삭제');
  });
  it('recipeDisplayName falls back to code then -', () => {
    expect(recipeDisplayName('GCP_INSTALL_V1')).toBe('GCP 인프라 설치');
    expect(recipeDisplayName('CUSTOM_UNKNOWN')).toBe('CUSTOM_UNKNOWN');
    expect(recipeDisplayName(null)).toBe('-');
  });
});

describe('KIND_POLICY', () => {
  it('carries the verbatim success-policy paragraphs', () => {
    expect(KIND_POLICY.TERRAFORM_JOB).toContain('디스패치한 모든 job을 polling 간격으로 폴링');
    expect(KIND_POLICY.CONDITION_CHECK).toContain('디스패치 없이 조건 확인 API를 polling 간격으로 호출');
  });
});

describe('taskMetaLine — FAILED', () => {
  it('uses effective_max_fail_count from detail', () => {
    const t = summary({ status: 'FAILED', fail_count: 1, error_code: 'JOB_FAILED' });
    expect(taskMetaLine(t, detail({ status: 'FAILED', effective_max_fail_count: 1 }))).toBe(
      '실패 1/1 — JOB_FAILED',
    );
  });
  it('falls back to ? without detail and to 원인 미기록 without a code', () => {
    expect(taskMetaLine(summary({ status: 'FAILED', fail_count: 2, error_code: 'JOB_FAILED' }))).toBe(
      '실패 2/? — JOB_FAILED',
    );
    expect(taskMetaLine(summary({ status: 'FAILED', fail_count: 1, error_code: null }))).toBe(
      '실패 1/? — 원인 미기록',
    );
  });
});

describe('taskMetaLine — DONE', () => {
  it('TERRAFORM_JOB: span + 시도 N회 (attempts.length)', () => {
    const t = summary({ status: 'DONE', started_at: START, finished_at: FINISH });
    const d = detail({
      status: 'DONE',
      attempts: [
        {
          attempt_number: 1,
          status: 'DONE',
          error_code: null,
          response: '{}',
          failure_detail: null,
          started_at: START,
          finished_at: FINISH,
          check: null,
          terraform_results: [],
          job_states: [],
        },
      ],
    });
    expect(taskMetaLine(t, d)).toBe('2026-06-30 14:02~2026-06-30 14:08 · 시도 1회');
  });

  it('CONDITION_CHECK: 폴 N회 = Σ check.call_count (locks sum, not attempts.length)', () => {
    const t = summary({ kind: 'CONDITION_CHECK', status: 'DONE', started_at: START, finished_at: FINISH });
    // ONE attempt whose check polled 3 times → sum(3) ≠ length(1).
    const d = detail({
      kind: 'CONDITION_CHECK',
      status: 'DONE',
      attempts: [
        {
          attempt_number: 1,
          status: 'DONE',
          error_code: null,
          response: null,
          failure_detail: null,
          started_at: START,
          finished_at: FINISH,
          terraform_results: [],
          job_states: [],
          check: {
            call_count: 3,
            not_met_count: 2,
            api_error_count: 0,
            call_timeout_count: 0,
            last_external_status: 'READY',
            last_checked_at: FINISH,
          },
        },
      ],
    });
    expect(taskMetaLine(t, d)).toBe('2026-06-30 14:02~2026-06-30 14:08 · 폴 3회');
  });

  it('without detail: span only; no started_at → 완료', () => {
    expect(taskMetaLine(summary({ status: 'DONE', started_at: START, finished_at: FINISH }))).toBe(
      '2026-06-30 14:02~2026-06-30 14:08',
    );
    expect(taskMetaLine(summary({ status: 'DONE', started_at: null }))).toBe('완료');
  });
});

describe('taskMetaLine — IN_PROGRESS', () => {
  it('start + retry when fail_count > 0', () => {
    const t = summary({ status: 'IN_PROGRESS', started_at: START, fail_count: 2 });
    expect(taskMetaLine(t, detail({ status: 'IN_PROGRESS', effective_max_fail_count: 6 }))).toBe(
      '2026-06-30 14:02 시작 · 재시도 2/6',
    );
  });
  it('no retry when fail_count 0; bare 시작 when no start', () => {
    expect(taskMetaLine(summary({ status: 'IN_PROGRESS', started_at: START, fail_count: 0 }))).toBe(
      '2026-06-30 14:02 시작',
    );
    expect(taskMetaLine(summary({ status: 'IN_PROGRESS', started_at: null }))).toBe('시작');
  });
});

describe('taskMetaLine — CANCELLED', () => {
  it('with / without started_at', () => {
    expect(
      taskMetaLine(summary({ status: 'CANCELLED', started_at: START, finished_at: FINISH })),
    ).toBe('취소됨 · 2026-06-30 14:02~2026-06-30 14:08');
    expect(taskMetaLine(summary({ status: 'CANCELLED', started_at: null }))).toBe('취소됨');
  });
});

describe('taskMetaLine — READY / BLOCKED (contract line, TTL omitted)', () => {
  it('CONDITION_CHECK: 주기 X · 한도 N회', () => {
    const t = summary({ kind: 'CONDITION_CHECK', status: 'READY' });
    const d = detail({
      kind: 'CONDITION_CHECK',
      status: 'READY',
      effective_polling_interval: 'PT10M',
      effective_execution_timeout: null,
      effective_max_fail_count: 6,
    });
    expect(taskMetaLine(t, d)).toBe('주기 10분 · 한도 6회');
  });
  it('TERRAFORM_JOB: 타임아웃 X · 한도 N회', () => {
    const t = summary({ status: 'BLOCKED' });
    expect(
      taskMetaLine(t, detail({ status: 'BLOCKED', effective_execution_timeout: 'PT30M', effective_max_fail_count: 1 })),
    ).toBe('타임아웃 30분 · 한도 1회');
  });
  it('returns empty string without detail', () => {
    expect(taskMetaLine(summary({ status: 'READY' }))).toBe('');
    expect(taskMetaLine(summary({ status: 'BLOCKED' }))).toBe('');
  });
});

describe('canCancel matrix', () => {
  it.each<[TaskStatus | 'RUNNING' | 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED', boolean, boolean]>([
    ['RUNNING', false, true],
    ['RUNNING', true, false],
    ['PENDING', false, true],
    ['PENDING', true, false],
    ['DONE', false, false],
    ['FAILED', false, false],
    ['CANCELLED', false, false],
  ])('%s cancelRequested=%s → %s', (status, requested, expected) => {
    // Only pipeline statuses feed canCancel; cast for the table's convenience.
    expect(canCancel(status as 'RUNNING', requested)).toBe(expected);
  });
});

describe('currentTask / currentTaskLabel / progressCount', () => {
  const tasks: TaskSummary[] = [
    summary({ sequence: 1, status: 'DONE' }),
    summary({ sequence: 2, status: 'FAILED' }),
    summary({ sequence: 3, status: 'READY' }),
  ];
  it('currentTask = lowest-seq of READY/IN_PROGRESS/FAILED', () => {
    expect(currentTask(tasks)?.sequence).toBe(2);
    expect(currentTask([summary({ sequence: 1, status: 'DONE' })])).toBeNull();
  });
  it('currentTaskLabel reflects PENDING / current / terminal', () => {
    expect(currentTaskLabel('PENDING', tasks)).toBe('시작 대기');
    expect(currentTaskLabel('RUNNING', tasks)).toBe('진행 중');
    expect(currentTaskLabel('DONE', [summary({ status: 'DONE' })])).toBe('완료');
    expect(currentTaskLabel('CANCELLED', [summary({ status: 'CANCELLED' })])).toBe('취소됨');
    expect(currentTaskLabel('FAILED', [summary({ status: 'DONE' })])).toBe('실패');
  });
  it('progressCount counts DONE over total', () => {
    expect(progressCount(tasks)).toEqual({ done: 1, total: 3 });
  });
});
