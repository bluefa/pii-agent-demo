// @vitest-environment jsdom
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestConnectionJob } from '@/app/lib/api';
import type {
  TestConnectionUIState,
  UseTestConnectionPollingReturn,
} from '@/app/hooks/useTestConnectionPolling';

const pollingState: { uiState: TestConnectionUIState; latestJob: TestConnectionJob | null } = {
  uiState: 'PENDING',
  latestJob: null,
};

vi.mock('@/app/hooks/useTestConnectionPolling', () => ({
  useTestConnectionPolling: (): UseTestConnectionPollingReturn => ({
    latestJob: pollingState.latestJob,
    uiState: pollingState.uiState,
    loading: false,
    triggerError: null,
    hasHistory: pollingState.latestJob !== null,
    trigger: vi.fn(),
  }),
}));

vi.mock('@/app/lib/api', () => ({
  getSecrets: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/theme', () => ({
  statusColors: { error: { text: '' } },
  textColors: { primary: '', tertiary: '', quaternary: '' },
  getButtonClass: () => '',
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/app/components/features/process-status/connection-test/ProgressBar', () => ({
  ProgressBar: () => null,
}));
vi.mock('@/app/components/features/process-status/connection-test/ResultSummary', () => ({
  ResultSummary: () => null,
}));

import { ConnectionTestPanel } from '@/app/components/features/process-status/ConnectionTestPanel';

const makeJob = (status: TestConnectionJob['status']): TestConnectionJob => ({
  id: 'job-1',
  target_source_id: 1010,
  status,
  requested_at: '2026-01-25T14:00:00Z',
  completed_at: status === 'PENDING' ? null : '2026-01-25T14:01:00Z',
  requested_by: 'tester',
  resource_results: [],
});

describe('ConnectionTestPanel SUCCESS refetch', () => {
  beforeEach(() => {
    pollingState.uiState = 'PENDING';
    pollingState.latestJob = makeJob('PENDING');
  });

  // Flush the shake effect's queued microtask (setIsShaking) so React state
  // updates settle inside act and don't leak past the assertion.
  const flush = () => act(async () => { await Promise.resolve(); });

  it('calls onResourceUpdate on PENDING → SUCCESS transition', async () => {
    const onResourceUpdate = vi.fn();
    const { rerender } = render(
      <ConnectionTestPanel targetSourceId={1010} confirmed={[]} onResourceUpdate={onResourceUpdate} />,
    );
    expect(onResourceUpdate).not.toHaveBeenCalled();

    pollingState.uiState = 'SUCCESS';
    pollingState.latestJob = makeJob('SUCCESS');
    rerender(
      <ConnectionTestPanel targetSourceId={1010} confirmed={[]} onResourceUpdate={onResourceUpdate} />,
    );
    await flush();

    expect(onResourceUpdate).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onResourceUpdate on PENDING → FAIL transition', async () => {
    const onResourceUpdate = vi.fn();
    const { rerender } = render(
      <ConnectionTestPanel targetSourceId={1010} confirmed={[]} onResourceUpdate={onResourceUpdate} />,
    );

    pollingState.uiState = 'FAIL';
    pollingState.latestJob = makeJob('FAIL');
    rerender(
      <ConnectionTestPanel targetSourceId={1010} confirmed={[]} onResourceUpdate={onResourceUpdate} />,
    );
    await flush();

    expect(onResourceUpdate).not.toHaveBeenCalled();
  });
});
