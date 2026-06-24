import { describe, expect, it } from 'vitest';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import {
  isInProgress,
  computeUIState,
  shouldStopPolling,
} from '@/app/hooks/useTestConnectionPolling';

// ADR-019: connection_status gained RUNNING. The polling state machine must
// treat PENDING and RUNNING as in-progress (keep polling) and only settle on
// SUCCESS/FAIL. These are the pure predicates that encode that.

const makeJob = (
  connectionStatus: TestConnectionVersionResult['connectionStatus'],
): TestConnectionVersionResult => ({
  targetSourceId: 1,
  testConnectionVersion: 1,
  connectionStatus,
  requestedAt: '2026-06-23T01:00:00.000Z',
  completedAt: connectionStatus === 'PENDING' || connectionStatus === 'RUNNING'
    ? ''
    : '2026-06-23T01:00:20.000Z',
  testConnectionAgentResults: [],
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
