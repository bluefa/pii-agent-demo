import { describe, expect, it } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { computeTcBuckets, foldAgentStatuses } from '@/lib/test-connection-summary';
import {
  stepHoldView,
  type StepHoldInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

const run = (
  status: NonNullable<TestConnectionVersionResult['connection_status']>,
  agents: readonly (readonly [string, string])[] = [['r-1', status === 'FAIL' ? 'FAIL' : status]],
): TestConnectionVersionResult => ({
  target_source_id: 1583,
  test_connection_version: 3,
  connection_status: status,
  requested_at: '2026-06-01T00:00:00Z',
  completed_at: status === 'SUCCESS' || status === 'FAIL' ? '2026-06-01T00:04:20Z' : null,
  test_connection_agent_results: agents.map(([resource_id, connection_status]) => ({
    agent_id: `a-${resource_id}`,
    resource_id,
    connection_status,
  })),
});

const statusRow = (over: Partial<TestConnectionStatusRow>): TestConnectionStatusRow => ({
  targetSourceId: 1583,
  status: null,
  serviceName: null,
  serviceCode: null,
  cloudProvider: null,
  rejectReason: null,
  rejectedAt: null,
  completedAt: null,
  ...over,
});

const OPEN = { kind: 'loaded', value: 'LATEST_TEST_CONNECTION_SUCCESS' } as const;

const input = (over: Partial<StepHoldInput> = {}, unitIds: readonly string[] = ['r-1']): StepHoldInput => {
  const latest = over.latest === undefined ? run('SUCCESS') : over.latest;
  return {
    processStatus: 'INSTALLED',
    isSdu: false,
    statusLoaded: true,
    tcStatus: null,
    tcStatusFailed: false,
    latest,
    latestFailed: false,
    buckets: computeTcBuckets(
      unitIds,
      foldAgentStatuses(latest?.test_connection_agent_results ?? [], new Set(unitIds)),
    ),
    completion: OPEN,
    ...over,
  };
};

describe('stepHoldView — 언제 서는가', () => {
  it('5단계가 아니면 null', () => {
    expect(stepHoldView(input({ processStatus: 'CONNECTED' }))).toBeNull();
    expect(stepHoldView(input({ processStatus: null }))).toBeNull();
  });

  it('SDU 는 승인 요청 버튼이 없어 null', () => {
    expect(stepHoldView(input({ isSdu: true }))).toBeNull();
  });

  it('조회 전에는 loading, 태그도 버튼도 없다', () => {
    const view = stepHoldView(input({ statusLoaded: false }));
    expect(view).toEqual({ state: 'loading', tag: undefined, canRequest: false, blockedHint: null });
  });
});

describe('stepHoldView — 열리는 유일한 국면: 성공 + 전부 연결 + 정책 OK + 미요청', () => {
  it('미요청(404) → 「승인 요청 대기」, 버튼 열림', () => {
    const view = stepHoldView(input());
    expect(view?.state).toBe('unmet');
    expect(view?.tag).toEqual({ tone: 'warn', label: '승인 요청 대기' });
    expect(view?.canRequest).toBe(true);
    expect(view?.blockedHint).toBeNull();
  });

  it('관리자가 돌려보낸 뒤(REJECTED)에도 정책이 허락하면 열린다 — 태그만 「재실행 요청됨」', () => {
    const view = stepHoldView(
      input({ tcStatus: statusRow({ status: 'TEST_CONNECTION_REJECTED', rejectedAt: '2026-07-19T05:52:00Z' }) }),
    );
    expect(view?.tag?.label).toBe('재실행 요청됨');
    expect(view?.canRequest).toBe(true);
  });
});

describe('stepHoldView — 서비스 Step 5 와 같은 게이트', () => {
  it('확정 단위 중 하나라도 연결 성공이 아니면 잠긴다 (ok !== total)', () => {
    const view = stepHoldView(input({ latest: run('SUCCESS', [['r-1', 'SUCCESS']]) }, ['r-1', 'r-2']));
    expect(view?.tag?.label).toBe('일부 리소스 미확인');
    expect(view?.canRequest).toBe(false);
    expect(view?.blockedHint).toContain('모든 리소스가 연결에 성공해야');
  });

  it('확정 단위가 없으면 잠긴다 (total === 0)', () => {
    const view = stepHoldView(input({}, []));
    expect(view?.canRequest).toBe(false);
  });

  it('completion-status 가 아직이면 잠기되 사유는 없다 (툴팁 없음)', () => {
    const view = stepHoldView(input({ completion: { kind: 'loading' } }));
    expect(view?.canRequest).toBe(false);
    expect(view?.blockedHint).toBeNull();
    expect(view?.tag?.label).toBe('승인 요청 대기');
  });

  it('completion-status 조회 실패는 모름 — 열지 않고 사유를 든다', () => {
    const view = stepHoldView(input({ completion: { kind: 'failed' } }));
    expect(view?.canRequest).toBe(false);
    expect(view?.blockedHint).toBe('승인 요청 가능 여부를 확인하지 못했습니다');
  });

  it('논리 DB 정책이 바뀌었으면 「재실행 필요」 로 잠긴다', () => {
    const view = stepHoldView(input({ completion: { kind: 'loaded', value: 'LOGICAL_DATABASE_RECENTLY_UPDATED' } }));
    expect(view?.tag?.label).toBe('재실행 필요');
    expect(view?.canRequest).toBe(false);
    expect(view?.blockedHint).toContain('논리 DB 정책이 마지막 실행 이후 바뀌었습니다');
  });

  it('TEST_CONNECTION_REQUIRED 도 「재실행 필요」', () => {
    const view = stepHoldView(input({ completion: { kind: 'loaded', value: 'TEST_CONNECTION_REQUIRED' } }));
    expect(view?.tag?.label).toBe('재실행 필요');
    expect(view?.canRequest).toBe(false);
  });

  it('CONFIRMED 는 요청됨으로 읽는다 — status 행이 늦게 따라오는 창', () => {
    const view = stepHoldView(input({ completion: { kind: 'loaded', value: 'CONFIRMED' } }));
    expect(view?.state).toBe('ok');
    expect(view?.tag?.label).toBe('승인 요청됨');
    expect(view?.canRequest).toBe(false);
  });

  it('계약 밖 값은 판정하지 않는다', () => {
    const view = stepHoldView(input({ completion: { kind: 'loaded', value: null } }));
    expect(view?.state).toBe('unknown');
    expect(view?.canRequest).toBe(false);
  });
});

describe('stepHoldView — 실행 쪽이 막을 때', () => {
  it('요청됨 → 충족 「승인 요청됨」, 버튼 없음 — 실행 판정보다 앞선다', () => {
    const view = stepHoldView(
      input({ tcStatus: statusRow({ status: 'TEST_CONNECTION_COMPLETED' }), latest: null, latestFailed: true }),
    );
    expect(view).toEqual({ state: 'ok', tag: { tone: 'ok', label: '승인 요청됨' }, canRequest: false, blockedHint: null });
  });

  it('status 조회 실패는 모름 — 미요청이라 부르지 않는다', () => {
    const view = stepHoldView(input({ tcStatusFailed: true }));
    expect(view?.state).toBe('unknown');
    expect(view?.tag).toBeUndefined();
    expect(view?.blockedHint).toBe('승인 요청 상태를 확인하지 못했습니다');
  });

  it('실행 없음(404) → 미충족 「실행 없음」, 잠김', () => {
    const view = stepHoldView(input({ latest: null }));
    expect(view?.state).toBe('unmet');
    expect(view?.tag?.label).toBe('실행 없음');
    expect(view?.canRequest).toBe(false);
    expect(view?.blockedHint).toBe('연결 테스트가 성공해야 승인 요청을 보낼 수 있습니다');
  });

  it('실패 → 미충족 「연결 테스트 실패」, 잠김', () => {
    const view = stepHoldView(input({ latest: run('FAIL') }));
    expect(view?.tag?.label).toBe('연결 테스트 실패');
    expect(view?.canRequest).toBe(false);
  });

  it('진행 중 → 판정 보류 「진행 중」, 잠김', () => {
    const view = stepHoldView(input({ latest: run('RUNNING') }));
    expect(view?.state).toBe('loading');
    expect(view?.tag?.label).toBe('진행 중');
    expect(view?.canRequest).toBe(false);
  });

  it('최신 실행 조회 실패는 모름', () => {
    const view = stepHoldView(input({ latest: null, latestFailed: true }));
    expect(view?.state).toBe('unknown');
    expect(view?.blockedHint).toBe('최신 연결 테스트 정보를 불러오지 못했습니다');
  });
});
