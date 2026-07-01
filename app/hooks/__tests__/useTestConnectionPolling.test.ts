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

