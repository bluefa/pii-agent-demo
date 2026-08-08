// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearTcJobsForTest, publishTcJob, useLiveTcJob } from '@/app/hooks/useLiveTcJob';
import type { TestConnectionVersionResult } from '@/app/lib/api';

const job = (version: number, status: string): TestConnectionVersionResult =>
  ({
    test_connection_version: version,
    connection_status: status,
  }) as unknown as TestConnectionVersionResult;

describe('useLiveTcJob', () => {
  beforeEach(() => {
    clearTcJobsForTest();
  });

  it('returns null until a poll publishes for this target', () => {
    const { result } = renderHook(() => useLiveTcJob(1010));
    expect(result.current).toBeNull();
  });

  it('delivers published observations to subscribers, keyed by target', () => {
    const { result } = renderHook(() => useLiveTcJob(1010));
    const other = renderHook(() => useLiveTcJob(1583));

    act(() => {
      publishTcJob(1010, job(6, 'RUNNING'));
    });
    expect(result.current?.test_connection_version).toBe(6);
    expect(other.result.current).toBeNull();

    act(() => {
      publishTcJob(1010, job(6, 'FAIL'));
    });
    expect(result.current?.connection_status).toBe('FAIL');
  });

  it('ignores null publishes — absence of a run is not knowledge', () => {
    const { result } = renderHook(() => useLiveTcJob(1010));
    act(() => {
      publishTcJob(1010, job(6, 'SUCCESS'));
      publishTcJob(1010, null);
    });
    expect(result.current?.test_connection_version).toBe(6);
  });
});
