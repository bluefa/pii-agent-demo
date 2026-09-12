import { describe, expect, it } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import type { TestConnectionStatusRow } from '@/lib/types/task-queue';
import { computeTcBuckets, foldAgentStatuses } from '@/lib/test-connection-summary';
import {
  rejectionIsStale,
  stepHoldView,
  type StepHoldInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/stepHold';

const run = (
  status: TestConnectionVersionResult['connection_status'],
  over: Partial<TestConnectionVersionResult> = {},
): TestConnectionVersionResult => ({
  target_source_id: 1583,
  test_connection_version: 3,
  connection_status: status,
  requested_at: '2026-06-01T00:00:00Z',
  completed_at: status === 'SUCCESS' || status === 'FAIL' ? '2026-06-01T00:04:20Z' : null,
  test_connection_agent_results: [
    { agent_id: 'a', resource_id: 'r-1', connection_status: status === 'FAIL' ? 'FAIL' : status },
  ],
  ...over,
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

const input = (over: Partial<StepHoldInput> = {}): StepHoldInput => {
  const latest = over.latest === undefined ? run('SUCCESS') : over.latest;
  const ids = ['r-1'];
  return {
    processStatus: 'INSTALLED',
    isSdu: false,
    statusLoaded: true,
    tcStatus: null,
    tcStatusFailed: false,
    latest,
    latestFailed: false,
    buckets: computeTcBuckets(
      ids,
      foldAgentStatuses(latest?.test_connection_agent_results ?? [], new Set(ids)),
    ),
    ...over,
  };
};

// 목 1583 의 상태 — 최신 실행 성공(06-01) 뒤 관리자가 재실행을 요청(07-19)했고 서비스는
// 아직 다시 실행하지 않았다.
const REJECTED_1583 = statusRow({
  status: 'TEST_CONNECTION_REJECTED',
  rejectedAt: '2026-07-19T05:52:00Z',
  rejectReason: '대상 3건 중 1건 접속 실패(10.20.4.18:1521 timeout)',
});

const labels = (view: ReturnType<typeof stepHoldView>) => view?.facts.map((f) => f.label ?? '');

describe('stepHoldView — 언제 서는가', () => {
  it('5단계가 아니면 null', () => {
    expect(stepHoldView(input({ processStatus: 'CONNECTED' }))).toBeNull();
    expect(stepHoldView(input({ processStatus: null }))).toBeNull();
  });

  it('SDU 는 승인 요청 버튼이 없어 null', () => {
    expect(stepHoldView(input({ isSdu: true }))).toBeNull();
  });

  it('조회 전에는 loading 이고 차례도 버튼도 없다', () => {
    const view = stepHoldView(input({ statusLoaded: false }));
    expect(view?.state).toBe('loading');
    expect(view?.turn).toBeNull();
    expect(view?.canRequest).toBe(false);
  });
});

describe('stepHoldView — 목 1583: 성공 + 재실행 요청됨', () => {
  const view = stepHoldView(input({ tcStatus: REJECTED_1583 }));

  it('미충족 「재실행 요청됨」 — 실행 결과, 반려 시각·사유, 다음 행동이 각자 한 줄', () => {
    expect(view?.state).toBe('unmet');
    expect(view?.tag).toEqual({ tone: 'warn', label: '재실행 요청됨' });
    expect(labels(view)).toEqual(['완료', '결과', '재실행 요청', '사유', '']);
    expect(view?.facts[0].value).toBe('26.06.01 09:04');
    expect(view?.facts[1].value).toBe('성공 1 · 실패 0');
    expect(view?.facts[2].value).toBe('26.07.19 14:52');
    expect(view?.facts[3].value).toContain('10.20.4.18:1521');
    expect(view?.facts[4].value).toContain('다시 실행하고 승인 요청을 누르면 6단계');
  });

  it('차례는 서비스 담당자, 관리자가 대신 누를 수 있다', () => {
    expect(view?.turn).toBe('지금은 서비스 담당자 차례입니다.');
    expect(view?.canRequest).toBe(true);
  });
});

describe('stepHoldView — 승인 요청 쪽', () => {
  it('성공 + 미요청(404) → 「승인 요청 대기」, 버튼 열림', () => {
    const view = stepHoldView(input({ tcStatus: null }));
    expect(view?.state).toBe('unmet');
    expect(view?.tag?.label).toBe('승인 요청 대기');
    expect(labels(view)).toEqual(['완료', '결과', '']);
    expect(view?.facts.at(-1)?.value).toBe('서비스 담당자가 5단계에서 승인 요청을 누르면 6단계로 넘어갑니다.');
    expect(view?.canRequest).toBe(true);
  });

  it('반려 뒤 새 실행이 성공했으면 반려는 지난 기록 — 「승인 요청 대기」 + 이전 실행 기준', () => {
    const view = stepHoldView(
      input({
        tcStatus: REJECTED_1583,
        latest: run('SUCCESS', { requested_at: '2026-08-01T00:00:00Z', completed_at: '2026-08-01T00:01:00Z' }),
      }),
    );
    expect(view?.tag?.label).toBe('승인 요청 대기');
    expect(view?.facts[2]).toEqual({ label: '재실행 요청', value: '26.07.19 14:52 · 이전 실행 기준' });
  });

  it('요청됨 → 충족 + 요청 시각, 차례는 단계 반영 대기, 버튼 없음', () => {
    const view = stepHoldView(
      input({ tcStatus: statusRow({ status: 'TEST_CONNECTION_COMPLETED', completedAt: '2026-06-01T01:00:00Z' }) }),
    );
    expect(view?.state).toBe('ok');
    expect(view?.tag?.label).toBe('승인 요청됨');
    expect(view?.facts[0]).toEqual({ label: '요청', value: '26.06.01 10:00' });
    expect(view?.turn).toBe('단계 반영을 기다리고 있습니다.');
    expect(view?.canRequest).toBe(false);
  });

  it('요청됨은 실행 판정보다 앞선다 — 실행 조회가 실패해도 충족', () => {
    const view = stepHoldView(
      input({
        tcStatus: statusRow({ status: 'TEST_CONNECTION_COMPLETED' }),
        latest: null,
        latestFailed: true,
      }),
    );
    expect(view?.state).toBe('ok');
  });

  it('status 조회 실패는 모름 — 미요청이라 부르지 않고 차례도 버튼도 없다', () => {
    const view = stepHoldView(input({ tcStatusFailed: true }));
    expect(view?.state).toBe('unknown');
    expect(view?.tag).toBeUndefined();
    expect(view?.turn).toBeNull();
    expect(view?.canRequest).toBe(false);
  });
});

describe('stepHoldView — 실행 쪽이 막을 때', () => {
  it('실행 없음(404) → 미충족 「실행 없음」, 버튼 잠김', () => {
    const view = stepHoldView(input({ latest: null }));
    expect(view?.state).toBe('unmet');
    expect(view?.tag?.label).toBe('실행 없음');
    expect(view?.turn).toBe('지금은 서비스 담당자 차례입니다.');
    expect(view?.canRequest).toBe(false);
  });

  it('실패 → 미충족 「연결 테스트 실패」 + 다시 실행 안내, 버튼 잠김', () => {
    const view = stepHoldView(input({ latest: run('FAIL') }));
    expect(view?.state).toBe('unmet');
    expect(view?.tag?.label).toBe('연결 테스트 실패');
    expect(view?.facts.at(-1)?.value).toContain('다시 실행한 뒤 승인 요청');
    expect(view?.canRequest).toBe(false);
  });

  it('진행 중 → 판정 보류 「진행 중」, 차례는 실행 종료 대기', () => {
    const view = stepHoldView(input({ latest: run('RUNNING') }));
    expect(view?.state).toBe('loading');
    expect(view?.tag?.label).toBe('진행 중');
    expect(view?.turn).toBe('연결 테스트가 끝나기를 기다리고 있습니다.');
    expect(view?.canRequest).toBe(false);
  });

  it('최신 실행 조회 실패는 모름', () => {
    const view = stepHoldView(input({ latest: null, latestFailed: true }));
    expect(view?.state).toBe('unknown');
    expect(view?.turn).toBeNull();
  });
});

describe('rejectionIsStale', () => {
  it('실행이 반려보다 늦게 요청됐을 때만 참', () => {
    expect(rejectionIsStale('2026-07-19T00:00:00Z', run('SUCCESS', { requested_at: '2026-08-01T00:00:00Z' }))).toBe(true);
    expect(rejectionIsStale('2026-07-19T00:00:00Z', run('SUCCESS', { requested_at: '2026-06-01T00:00:00Z' }))).toBe(false);
    expect(rejectionIsStale(null, run('SUCCESS'))).toBe(false);
    expect(rejectionIsStale('2026-07-19T00:00:00Z', null)).toBe(false);
  });
});
