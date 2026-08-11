// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { getTestConnectionLatest } from '@/app/lib/api';
import { AppError } from '@/lib/errors';
import {
  isInProgress,
  computeUIState,
  shouldStopPolling,
  fetchLatestTest,
} from '@/app/hooks/useTestConnectionPolling';

vi.mock('@/app/lib/api', () => ({
  getTestConnectionLatest: vi.fn(),
  triggerTestConnection: vi.fn(),
}));

// ADR-019: connection_status gained RUNNING. The polling state machine must
// treat PENDING and RUNNING as in-progress (keep polling) and only settle on
// SUCCESS/FAIL. These are the pure predicates that encode that.

const makeJob = (
  connection_status: TestConnectionVersionResult['connection_status'],
): TestConnectionVersionResult => ({
  target_source_id: 1,
  test_connection_version: 1,
  connection_status,
  requested_at: '2026-06-23T01:00:00.000Z',
  completed_at: connection_status === 'PENDING' || connection_status === 'RUNNING'
    ? ''
    : '2026-06-23T01:00:20.000Z',
  test_connection_agent_results: [],
});

describe('isInProgress', () => {
  it('is true for PENDING and RUNNING', () => {
    expect(isInProgress('PENDING')).toBe(true);
    expect(isInProgress('RUNNING')).toBe(true);
  });

  it('is false for SUCCESS and FAIL', () => {
    expect(isInProgress('SUCCESS')).toBe(false);
    expect(isInProgress('FAIL')).toBe(false);
  });
});

describe('computeUIState', () => {
  it('maps RUNNING and PENDING to PENDING (in-progress UI)', () => {
    expect(computeUIState(makeJob('RUNNING'))).toBe('PENDING');
    expect(computeUIState(makeJob('PENDING'))).toBe('PENDING');
  });

  it('maps SUCCESS/FAIL through; null → IDLE', () => {
    expect(computeUIState(makeJob('SUCCESS'))).toBe('SUCCESS');
    expect(computeUIState(makeJob('FAIL'))).toBe('FAIL');
    expect(computeUIState(null)).toBe('IDLE');
  });
});

describe('fetchLatestTest', () => {
  it('maps NOT_FOUND to null (no test yet — legitimate IDLE)', async () => {
    vi.mocked(getTestConnectionLatest).mockRejectedValueOnce(
      new AppError({ status: 404, code: 'NOT_FOUND', message: 'no test', retriable: false }),
    );
    await expect(fetchLatestTest(1)).resolves.toBeNull();
  });

  it('rethrows every other error instead of masking it as IDLE', async () => {
    const err = new AppError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'boom',
      retriable: true,
    });
    vi.mocked(getTestConnectionLatest).mockRejectedValueOnce(err);
    await expect(fetchLatestTest(1)).rejects.toBe(err);
  });

  it('rethrows a non-AppError rejection even if it carries code NOT_FOUND', async () => {
    const impostor = { code: 'NOT_FOUND' };
    vi.mocked(getTestConnectionLatest).mockRejectedValueOnce(impostor);
    await expect(fetchLatestTest(1)).rejects.toBe(impostor);
  });
});

describe('shouldStopPolling', () => {
  it('keeps polling (false) while RUNNING or PENDING', () => {
    expect(shouldStopPolling(makeJob('RUNNING'))).toBe(false);
    expect(shouldStopPolling(makeJob('PENDING'))).toBe(false);
  });

  it('stops (true) on SUCCESS, FAIL, or no job', () => {
    expect(shouldStopPolling(makeJob('SUCCESS'))).toBe(true);
    expect(shouldStopPolling(makeJob('FAIL'))).toBe(true);
    expect(shouldStopPolling(null)).toBe(true);
  });
});


/**
 * 실행 시작 요청이 떠 있는 동안의 재진입. `uiState === 'PENDING'` 은 latest_version 이 새
 * 실행을 되돌려준 뒤에야 켜지므로, 그 왕복(mock 1s, 실서버도 수백 ms) 동안 Run Test 는
 * 여전히 눌리는 상태였다 — 두 번째 클릭이 두 번째 POST 를 쏘고 409 를 받아, 사용자가 부른
 * 적 없는 "이미 진행 중인 테스트가 있습니다" 가 떴다. 훅이 스스로 막는다.
 */
describe('trigger re-entrancy', () => {
  it('ignores a second trigger while the first is still in flight', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { triggerTestConnection } = await import('@/app/lib/api');
    const { useTestConnectionPolling } = await import('@/app/hooks/useTestConnectionPolling');

    const triggerMock = vi.mocked(triggerTestConnection);
    const latestMock = vi.mocked(getTestConnectionLatest);
    triggerMock.mockReset();
    latestMock.mockReset();

    // 첫 trigger 의 latest_version 을 손으로 붙잡아, 요청이 떠 있는 상태를 만든다.
    let releaseLatest!: () => void;
    latestMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseLatest = () => resolve(makeJob('PENDING'));
        }),
    );
    triggerMock.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useTestConnectionPolling(1));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.trigger();
      second = result.current.trigger();
    });

    // 두 번째 호출은 POST 를 쏘지 않고 false 로 돌아간다.
    await expect(second).resolves.toBe(false);
    expect(triggerMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseLatest();
      await first;
    });
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * POST 는 성공했는데 직후 latest_version 조회만 실패한 경우. usePollingBase 의 refresh 는
 * 조회 실패를 삼키고 그냥 반환하므로, 요청 종료를 신호로 잠금을 풀면 새 실행을 한 번도 못 본
 * 채 버튼이 열린다 — 그 상태로 다시 누르면 이 브랜치가 없애려던 409 를 그대로 받는다.
 */
describe('trigger lock vs. a failed post-trigger refresh', () => {
  it('stays locked when the POST succeeded but the follow-up read failed', async () => {
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { triggerTestConnection } = await import('@/app/lib/api');
    const { useTestConnectionPolling } = await import('@/app/hooks/useTestConnectionPolling');

    const triggerMock = vi.mocked(triggerTestConnection);
    const latestMock = vi.mocked(getTestConnectionLatest);
    triggerMock.mockReset();
    latestMock.mockReset();
    triggerMock.mockResolvedValue(undefined as never);
    latestMock.mockRejectedValue(new AppError({ code: 'INTERNAL_ERROR', message: 'boom', status: 503, retriable: true, timestamp: '2026-08-11T00:00:00.000Z' }));

    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(latestMock).toHaveBeenCalled());

    await act(async () => {
      await result.current.trigger();
    });

    // 실행은 서버에 만들어졌는데 우리는 아직 그것을 못 봤다 — 잠금은 유지된다.
    expect(result.current.triggering).toBe(true);
  });
});
