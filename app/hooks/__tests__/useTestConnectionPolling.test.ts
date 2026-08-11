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
 * canRunTest 는 "실행을 시작해도 되는가"를 하나로 답한다. 화면이 조건을 조립하면 항을 하나씩
 * 빠뜨리고, 빠뜨린 항이 곧 "아직 모르는데 누를 수 있는" 창이 된다 — 이 브랜치의 결함 대부분이
 * 그 창이었다. 그래서 상태 기계를 여기서 못 박는다.
 */
describe('canRunTest', () => {
  const setup = async () => {
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { triggerTestConnection } = await import('@/app/lib/api');
    const { useTestConnectionPolling } = await import('@/app/hooks/useTestConnectionPolling');
    const triggerMock = vi.mocked(triggerTestConnection);
    const latestMock = vi.mocked(getTestConnectionLatest);
    triggerMock.mockReset();
    latestMock.mockReset();
    return { renderHook, act, waitFor, triggerMock, latestMock, useTestConnectionPolling };
  };

  const netError = () =>
    new AppError({ code: 'INTERNAL_ERROR', message: 'boom', status: 503, retriable: true });

  it('is false before the first read answers', async () => {
    const { renderHook, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useTestConnectionPolling(1));
    expect(result.current.canRunTest).toBe(false);
  });

  it('is true once a settled read lands', async () => {
    const { renderHook, waitFor, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockResolvedValue(makeJob('SUCCESS'));
    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.canRunTest).toBe(true));
  });

  // 조회 실패는 "돌고 있지 않다"가 아니라 "모른다"다 — 모르면 시작하게 두지 않는다.
  it('is false when the read failed, even though loading has ended', async () => {
    const { renderHook, waitFor, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockRejectedValue(netError());
    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.fetchError).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(result.current.canRunTest).toBe(false);
  });

  it('is false while a run reported by the last read is still in progress', async () => {
    const { renderHook, waitFor, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockResolvedValue(makeJob('PENDING'));
    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.uiState).toBe('PENDING'));
    expect(result.current.canRunTest).toBe(false);
  });

  /**
   * 응답을 못 받은 POST 실패(NETWORK·TIMEOUT)는 서버가 요청을 받지 않았다는 증거가 아니다.
   * 그 자리에서 잠금을 풀면 이미 만들어진 실행 위에 두 번째 요청이 나간다.
   */
  it('stays false after a POST that failed without a response', async () => {
    const { renderHook, act, waitFor, triggerMock, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockResolvedValue(makeJob('SUCCESS'));
    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.canRunTest).toBe(true));

    triggerMock.mockRejectedValue(netError());
    latestMock.mockRejectedValue(netError());
    await act(async () => {
      await result.current.trigger();
    });
    expect(result.current.canRunTest).toBe(false);
  });

  /**
   * 잠금의 반대 위험 — 조회가 계속 실패하면 폴링은 포기하고, 해제는 조회 성공으로만 일어난다.
   * retry() 가 없으면 버튼은 언마운트 전까지 영영 돌아오지 않는다.
   */
  it('recovers through retry() after the reads start succeeding again', async () => {
    const { renderHook, act, waitFor, latestMock, useTestConnectionPolling } = await setup();
    latestMock.mockRejectedValue(netError());
    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.canRunTest).toBe(false));

    latestMock.mockResolvedValue(makeJob('SUCCESS'));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.canRunTest).toBe(true));
  });
});

/**
 * 한 번 성공한 뒤 이어지는 조회가 실패하는 경우. `observed` 는 이미 true 라 그것만으로는
 * 막히지 않는다 — 우리가 든 그림이 낡았다는 사실은 fetchError 만 알고 있다. 이 항이 빠지면
 * 서버 상태를 모르는 채로 버튼이 살아난다.
 */
describe('canRunTest after a read starts failing', () => {
  it('is false once a later read fails, even though an earlier one succeeded', async () => {
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { useTestConnectionPolling } = await import('@/app/hooks/useTestConnectionPolling');
    const latestMock = vi.mocked(getTestConnectionLatest);
    latestMock.mockReset();
    latestMock.mockResolvedValue(makeJob('SUCCESS'));

    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.canRunTest).toBe(true));

    latestMock.mockRejectedValue(
      new AppError({ code: 'INTERNAL_ERROR', message: 'boom', status: 503, retriable: true }),
    );
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.fetchError).not.toBeNull());
    expect(result.current.canRunTest).toBe(false);
  });
});

/**
 * 잠금의 정상 해제 경로. 이것이 고정되어 있지 않으면 "영영 잠긴다"는 반대쪽 결함이 조용히
 * 들어온다 — 실행을 시작해 놓고 결과를 봤는데도 버튼이 돌아오지 않는 상태.
 */
describe('trigger lock release', () => {
  it('releases once a read lands after the trigger', async () => {
    const { renderHook, act, waitFor } = await import('@testing-library/react');
    const { triggerTestConnection } = await import('@/app/lib/api');
    const { useTestConnectionPolling } = await import('@/app/hooks/useTestConnectionPolling');
    const triggerMock = vi.mocked(triggerTestConnection);
    const latestMock = vi.mocked(getTestConnectionLatest);
    triggerMock.mockReset();
    latestMock.mockReset();
    latestMock.mockResolvedValue(makeJob('SUCCESS'));
    triggerMock.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useTestConnectionPolling(1));
    await waitFor(() => expect(result.current.canRunTest).toBe(true));

    await act(async () => {
      await result.current.trigger();
    });
    await waitFor(() => expect(result.current.triggering).toBe(false));
    expect(result.current.canRunTest).toBe(true);
  });
});
