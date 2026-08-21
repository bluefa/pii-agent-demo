import { describe, expect, it } from 'vitest';
import {
  canCancel,
  currentTask,
  currentTaskLabel,
  elapsedMs,
  fmtDateTime,
  fmtDateTimeSec,
  fmtDuration,
  fmtElapsedMs,
  fmtRelativeTime,
  fmtTimeMs,
  KIND_POLICY,
  progressCount,
  progressPhrase,
  providerAccentVar,
  providerKey,
  providerLabel,
  RECIPE_LABELS,
  recipeDisplayName,
  recipeLabel,
  runWindow,
  statusKo,
  stripTerraformAction,
  taskInfraSide,
  taskMetaLine,
  taskRunLine,
} from '@/lib/pipeline/format';
import type { TaskDetail, TaskStatus, TaskSummary } from '@/lib/pipeline/types';

// ── fixtures ────────────────────────────────────────────────────────────────
const summary = (over: Partial<TaskSummary>): TaskSummary => ({
  task_id: 1,
  sequence: 1,
  kind: 'TERRAFORM_JOB',
  task_definition: 'AWS_SERVICE_APPLY_V1',
  operation: 'AWS_SERVICE_TF_APPLY',
  terraform_action: 'APPLY',
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
  terraform_action: 'APPLY',
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

describe('fmtDateTimeSec', () => {
  it('formats with seconds (schedule times — start-delay is second-scale)', () => {
    expect(fmtDateTimeSec('2026-06-30T05:02:17Z')).toBe('2026-06-30 14:02:17');
  });
  it('normalizes midnight and keeps the seconds tail', () => {
    expect(fmtDateTimeSec('2026-06-29T15:00:05Z')).toBe('2026-06-30 00:00:05');
  });
  it('returns - for null / invalid', () => {
    expect(fmtDateTimeSec(null)).toBe('-');
    expect(fmtDateTimeSec('not-a-date')).toBe('-');
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

describe('taskInfraSide — 서비스측/BDC측 derivation', () => {
  it('maps *_SERVICE_* and IDC CX names to SERVICE', () => {
    expect(taskInfraSide('AWS_SERVICE_PLAN_V1')).toBe('SERVICE');
    expect(taskInfraSide('GCP_SERVICE_DESTROY_V1')).toBe('SERVICE');
    expect(taskInfraSide('IDC_CX_APPLY_V1')).toBe('SERVICE');
    expect(taskInfraSide('AWS_SERVICE_TF_APPLY')).toBe('SERVICE');
  });
  it('maps *_BDC_* / IDC BDP names to BDC — including AWS_BDC_SERVICE_LEVEL_*', () => {
    expect(taskInfraSide('AWS_BDC_COMMON_APPLY_V1')).toBe('BDC');
    expect(taskInfraSide('AWS_BDC_SERVICE_LEVEL_PLAN_V1')).toBe('BDC');
    expect(taskInfraSide('AZURE_BDC_DESTROY_V1')).toBe('BDC');
    expect(taskInfraSide('IDC_BDP_APPLY_V1')).toBe('BDC');
  });
  it('returns null for side-less names and blank input', () => {
    expect(taskInfraSide('NETWORK_READY_V1')).toBeNull();
    expect(taskInfraSide(null)).toBeNull();
    expect(taskInfraSide(undefined)).toBeNull();
    // Substring must not match across token boundaries (SERVICES ≠ SERVICE).
    expect(taskInfraSide('AWS_SERVICES_PLAN_V1')).toBeNull();
  });
});

describe('exec-band helpers (design-benchmark 시안 1·2·5)', () => {
  const chain = (statuses: TaskStatus[], over: Partial<TaskSummary>[] = []): TaskSummary[] =>
    statuses.map((status, i) =>
      summary({ task_id: i + 1, sequence: i + 1, status, ...(over[i] ?? {}) }),
    );

  it('statusKo — 한글 한 벌; PENDING/READY/BLOCKED는 대기로 접힌다', () => {
    expect(statusKo('RUNNING')).toBe('실행 중');
    expect(statusKo('IN_PROGRESS')).toBe('실행 중');
    expect(statusKo('PENDING')).toBe('대기');
    expect(statusKo('READY')).toBe('대기');
    expect(statusKo('BLOCKED')).toBe('대기');
    expect(statusKo('DONE')).toBe('완료');
    expect(statusKo('FAILED')).toBe('실패');
    expect(statusKo('CANCELLED')).toBe('중단');
  });

  it('progressPhrase — 완료 수가 아니라 현재 단계 서수 (2번째 실행 중 = 2/4)', () => {
    expect(progressPhrase('RUNNING', chain(['DONE', 'IN_PROGRESS', 'BLOCKED', 'BLOCKED']))).toBe(
      '2/4단계 실행 중',
    );
    expect(progressPhrase('FAILED', chain(['DONE', 'FAILED', 'BLOCKED', 'BLOCKED']))).toBe(
      '2/4단계에서 실패',
    );
    expect(progressPhrase('DONE', chain(['DONE', 'DONE']))).toBe('2단계 완료');
    // CANCELLED 접미사 없음 — 옆의 상태 pill이 이미 '중단'을 말한다.
    expect(progressPhrase('CANCELLED', chain(['DONE', 'CANCELLED', 'CANCELLED']))).toBe(
      '1/3단계 완료',
    );
    expect(progressPhrase('PENDING', chain(['BLOCKED', 'BLOCKED']))).toBe('0/2단계 완료');
  });

  it('runWindow — 태스크 타임스탬프에서 유도; 라이브는 end=null', () => {
    const t = chain(
      ['DONE', 'IN_PROGRESS'],
      [
        { started_at: '2026-08-09T01:09:00Z', finished_at: '2026-08-09T01:20:00Z' },
        { started_at: '2026-08-09T01:21:00Z', finished_at: null },
      ],
    );
    expect(runWindow('RUNNING', t, '2026-08-09T01:25:00Z')).toEqual({
      start: '2026-08-09T01:09:00Z',
      end: null,
    });
    // 실패 태스크의 finished_at이 비어도 종료가 터미널 전이 시각(last_activity_at)
    // 밑으로 내려가지 않는다 — max(finished_at)=01:20 < last_activity=01:25.
    expect(runWindow('FAILED', t, '2026-08-09T01:25:00Z')).toEqual({
      start: '2026-08-09T01:09:00Z',
      end: '2026-08-09T01:25:00Z',
    });
    // finished_at이 last_activity_at보다 늦으면 finished_at이 이긴다.
    const lateFinish = chain(
      ['DONE'],
      [{ started_at: '2026-08-09T01:09:00Z', finished_at: '2026-08-09T01:30:00Z' }],
    );
    expect(runWindow('DONE', lateFinish, '2026-08-09T01:25:00Z')).toEqual({
      start: '2026-08-09T01:09:00Z',
      end: '2026-08-09T01:30:00Z',
    });
    // 시작 전 취소 — started_at이 하나도 없으면 구간 자체가 없다.
    expect(runWindow('CANCELLED', chain(['CANCELLED']), '2026-08-09T01:25:00Z')).toEqual({
      start: null,
      end: null,
    });
    // 종료 상태인데 finished_at이 비면 last_activity_at이 종료 시각 대리.
    const noFinish = chain(['CANCELLED'], [{ started_at: '2026-08-09T01:09:00Z' }]);
    expect(runWindow('CANCELLED', noFinish, '2026-08-09T01:25:00Z')).toEqual({
      start: '2026-08-09T01:09:00Z',
      end: '2026-08-09T01:25:00Z',
    });
  });

  it('fmtElapsedMs — 초/분/시간 3단', () => {
    expect(fmtElapsedMs(42_000)).toBe('42초');
    expect(fmtElapsedMs(31 * 60_000 + 40_000)).toBe('31분');
    expect(fmtElapsedMs(2 * 3_600_000 + 5 * 60_000)).toBe('2시간 5분');
    expect(fmtElapsedMs(-1)).toBe('-');
    expect(fmtElapsedMs(Number.NaN)).toBe('-');
  });

});

describe('taskRunLine — 카드 실행 요약 (시안 F)', () => {
  it('끝난 태스크는 시작·완료 시각과 소요를 모두 말한다', () => {
    expect(
      taskRunLine(
        summary({
          status: 'DONE',
          started_at: '2026-08-14T10:41:00Z',
          finished_at: '2026-08-14T10:43:00Z',
        }),
      ),
    ).toEqual({
      startedAt: '2026-08-14 19:41',
      finishedAt: '2026-08-14 19:43',
      elapsed: '2분',
    });
  });

  it('판정은 담지 않는다 — 테두리·코너 배지 몫이라 상태가 달라도 같은 값이 나온다', () => {
    const at = { started_at: '2026-08-14T10:41:00Z', finished_at: '2026-08-14T10:43:00Z' };
    const statuses: TaskStatus[] = ['DONE', 'FAILED', 'CANCELLED'];
    for (const status of statuses) {
      expect(taskRunLine(summary({ status, ...at }))).toEqual({
        startedAt: '2026-08-14 19:41',
        finishedAt: '2026-08-14 19:43',
        elapsed: '2분',
      });
    }
  });

  it('시작 전 태스크는 세 칸 모두 비어 있다', () => {
    expect(taskRunLine(summary({ status: 'BLOCKED' }))).toEqual({
      startedAt: '-',
      finishedAt: '-',
      elapsed: null,
    });
  });

  it('진행 중이면 완료 시각과 소요가 비고 시작 시각만 찬다 — 경과 시계는 실행 밴드 몫', () => {
    expect(
      taskRunLine(summary({ status: 'IN_PROGRESS', started_at: '2026-08-14T10:41:00Z' })),
    ).toEqual({ startedAt: '2026-08-14 19:41', finishedAt: '-', elapsed: null });
  });

  it('종료 시각이 비어 온 FAILED도 같은 갈래로 떨어진다', () => {
    expect(
      taskRunLine(summary({ status: 'FAILED', fail_count: 2, started_at: '2026-08-14T08:20:00Z' })),
    ).toEqual({ startedAt: '2026-08-14 17:20', finishedAt: '-', elapsed: null });
  });

  it('종료가 시작보다 이르면 소요를 지어내지 않고 비운다', () => {
    expect(
      taskRunLine(
        summary({
          status: 'DONE',
          started_at: '2026-08-14T10:43:00Z',
          finished_at: '2026-08-14T10:41:00Z',
        }),
      ).elapsed,
    ).toBeNull();
  });
});

describe('stripTerraformAction — 카드 제목의 실행 종류 접미사', () => {
  it('후행 Plan/Apply/Destroy 를 뗀다', () => {
    expect(stripTerraformAction('AWS Service Level 테라폼 Plan', 'PLAN')).toBe(
      'AWS Service Level 테라폼',
    );
    expect(stripTerraformAction('Azure BDC 테라폼 Apply', 'APPLY')).toBe('Azure BDC 테라폼');
    expect(stripTerraformAction('AWS BDC 테라폼 Destroy', 'DESTROY')).toBe('AWS BDC 테라폼');
  });

  it('접미사가 없거나 action 이 null 이면 원문 그대로', () => {
    expect(stripTerraformAction('네트워크 준비 확인', null)).toBe('네트워크 준비 확인');
    expect(stripTerraformAction('Apply 이후 검증', 'APPLY')).toBe('Apply 이후 검증');
  });

  it('단어 경계를 지킨다 — 이름 끝이 우연히 같은 글자로 끝나도 자르지 않는다', () => {
    expect(stripTerraformAction('BDC 테라폼 Preplan', 'PLAN')).toBe('BDC 테라폼 Preplan');
  });

  it('떼면 빈 이름이 되는 경우에는 원문을 지킨다', () => {
    expect(stripTerraformAction('Apply', 'APPLY')).toBe('Apply');
  });
});

/**
 * 경과는 기준점이 상태에 따라 갈린다. orchestrator가 `last_activity_at`을 쓰는 곳은
 * 생성과 종단 전이뿐이라, 살아 있는 행에서는 그 값이 `created_at`과 같다 — 라이브
 * 분기를 지우면 실행 중 행이 전부 "0초"가 된다. 아래 두 케이스는 같은 픽스처에서
 * 그 갈림을 직접 깨뜨려 확인한다.
 */
describe('elapsedMs — 기준점은 상태가 정한다', () => {
  const created = '2026-08-14T01:00:00Z';
  const stampedAtCreate = created; // 실제 오케스트레이터의 라이브 행 모습
  const now = Date.parse('2026-08-14T01:47:00Z');

  it('라이브 행은 now로 잰다 — last_activity_at은 created_at에 고정돼 있다', () => {
    for (const live of ['RUNNING', 'PENDING'] as const) {
      expect(elapsedMs(live, created, stampedAtCreate, now)).toBe(47 * 60_000);
    }
  });

  it('종단 행은 last_activity_at에서 멈춘다 — now가 흘러도 값이 자라지 않는다', () => {
    const ended = '2026-08-14T01:12:00Z';
    for (const terminal of ['DONE', 'FAILED', 'CANCELLED'] as const) {
      expect(elapsedMs(terminal, created, ended, now)).toBe(12 * 60_000);
      // now를 하루 밀어도 같은 값이어야 한다 — 끝난 일은 더 길어지지 않는다.
      expect(elapsedMs(terminal, created, ended, now + 86_400_000)).toBe(12 * 60_000);
    }
  });

  it('브라우저 시계가 뒤처지면 음수를 그대로 넘긴다 — 낮추는 건 fmtElapsedMs의 일', () => {
    const skewed = Date.parse('2026-08-14T00:59:00Z');
    expect(elapsedMs('RUNNING', created, stampedAtCreate, skewed)).toBeLessThan(0);
    expect(fmtElapsedMs(elapsedMs('RUNNING', created, stampedAtCreate, skewed))).toBe('-');
  });
});

/**
 * 로그 줄의 시각 — 뷰어가 KST 로 읽는다는 것과, 자정을 '24'로 주는 ICU 빌드에서도
 * '00'으로 넘어간다는 것 두 가지를 고정한다(fmtDateTimeSec 의 자정 규칙과 같은 짝).
 */
describe('fmtTimeMs', () => {
  it('UTC instant 를 Asia/Seoul 시각으로 밀리초까지 찍는다', () => {
    expect(fmtTimeMs('2026-08-20T04:05:06.078Z')).toBe('13:05:06.078');
  });

  it('KST 자정은 24 시가 아니라 00 시다', () => {
    // 15:00Z = 다음 날 00:00 KST — hour12:false 를 '24'로 주는 ICU 빌드가 있다.
    expect(fmtTimeMs('2026-08-20T15:00:00.000Z').slice(0, 2)).toBe('00');
  });

  it('없거나 해석 불가한 값은 —(하이픈)', () => {
    expect(fmtTimeMs(null)).toBe('-');
    expect(fmtTimeMs('')).toBe('-');
    expect(fmtTimeMs('not-a-date')).toBe('-');
  });
});
